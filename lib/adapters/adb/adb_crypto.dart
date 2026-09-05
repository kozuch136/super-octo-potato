import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

/// RSA key handling for the ADB (Android Debug Bridge) authentication
/// handshake.
///
/// ADB's device-side ("adbd") signature verification is implemented with
/// the embedded/"mincrypt" RSA routines, which need the public key encoded
/// in a fixed little-endian struct (not X.509/DER) carrying pre-computed
/// Montgomery multiplication parameters. That struct layout comes from the
/// AOSP source `system/core/libcrypto_utils/android_pubkey.cpp`
/// (`AndroidPubkeyEncode`):
///
/// ```
/// struct RSAPublicKey {
///   uint32_t modulus_size_words;   // ANDROID_PUBKEY_MODULUS_SIZE_WORDS (64 for 2048-bit)
///   uint32_t n0inv;                // -1 / n[0] mod 2^32
///   uint8_t  modulus[256];         // little-endian
///   uint8_t  rr[256];              // little-endian R^2 mod n, R = 2^2048
///   uint32_t exponent;             // public exponent (65537)
/// };
/// ```
/// The struct is base64-encoded and a trailing `" user@host"` comment is
/// appended, exactly like the `adbkey.pub` file `adb keygen` produces.
///
/// The AUTH signature itself is a plain PKCS#1 v1.5 signature (RFC 8017,
/// EMSA-PKCS1-v1_5) over the 20-byte random token the device sends, using
/// the standard DigestInfo prefix for SHA-1 - but the token is used
/// directly as the "hash" (adbd never re-hashes it), so we must build the
/// DigestInfo/pad/RSA-encrypt pipeline manually instead of using a signer
/// that hashes its input first.
class AdbCrypto {
  static const int _modulusBits = 2048;
  static const int _modulusBytes = _modulusBits ~/ 8; // 256
  static const int _modulusWords = _modulusBytes ~/ 4; // 64

  /// Standard DER prefix for a SHA-1 DigestInfo (RFC 8017 Appendix, widely
  /// published PKCS#1 constant): SEQUENCE { SEQUENCE { OID sha1, NULL },
  /// OCTET STRING(20) }.
  static final Uint8List _sha1DigestInfoPrefix = Uint8List.fromList([
    0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05,
    0x00, 0x04, 0x14, //
  ]);

  static AsymmetricKeyPair<PublicKey, PrivateKey> generateKeyPair() {
    final secureRandom = FortunaRandom();
    final seedSource = Random.secure();
    final seed = Uint8List.fromList(
        List<int>.generate(32, (_) => seedSource.nextInt(256)));
    secureRandom.seed(KeyParameter(seed));

    final keyGen = RSAKeyGenerator()
      ..init(ParametersWithRandom(
        RSAKeyGeneratorParameters(BigInt.from(65537), _modulusBits, 64),
        secureRandom,
      ));
    return keyGen.generateKeyPair();
  }

  /// Encodes [publicKey] into the base64 `RSAPublicKey` struct + comment
  /// format `adbd` expects when it is shown the "Allow USB/network
  /// debugging?" prompt and later verifies our signature.
  static String encodePublicKey(RSAPublicKey publicKey, {String comment = 'flutter@wifi-tv-remote'}) {
    final n = publicKey.modulus!;
    final e = publicKey.publicExponent!;

    final r32 = BigInt.one << 32;
    final nMod32 = n % r32;
    final inv = nMod32.modInverse(r32);
    final n0inv = (r32 - inv) % r32;

    final r = BigInt.one << (_modulusBytes * 8); // 2^2048
    final rr = r.modPow(BigInt.two, n); // R^2 mod n

    final buffer = BytesBuilder();
    buffer.add(_uint32LE(_modulusWords));
    buffer.add(_uint32LE(n0inv.toInt()));
    buffer.add(_bigIntToBytesLE(n, _modulusBytes));
    buffer.add(_bigIntToBytesLE(rr, _modulusBytes));
    buffer.add(_uint32LE(e.toInt()));

    final b64 = base64.encode(buffer.toBytes());
    return '$b64 $comment';
  }

  /// Produces the raw PKCS#1 v1.5 signature adbd expects in the AUTH
  /// SIGNATURE packet for the given 20-byte [token].
  static Uint8List signToken(RSAPrivateKey privateKey, Uint8List token) {
    final digestInfo = Uint8List.fromList([..._sha1DigestInfoPrefix, ...token]);
    final signer = PKCS1Encoding(RSAEngine())
      ..init(true, PrivateKeyParameter<RSAPrivateKey>(privateKey));
    return signer.process(digestInfo);
  }

  static Uint8List _uint32LE(int value) {
    final b = ByteData(4);
    b.setUint32(0, value, Endian.little);
    return b.buffer.asUint8List();
  }

  static Uint8List _bigIntToBytesLE(BigInt value, int length) {
    final out = Uint8List(length);
    var v = value;
    final mask = BigInt.from(0xff);
    for (var i = 0; i < length; i++) {
      out[i] = (v & mask).toInt();
      v = v >> 8;
    }
    return out;
  }

  /// Serializes a key pair to a JSON-safe map (hex-encoded BigInts) so it
  /// can be persisted in secure storage and reused across app restarts -
  /// adbd remembers our public key fingerprint, so generating a new key
  /// every launch would force the user to re-accept the pairing prompt
  /// every time.
  static Map<String, String> serializeKeyPair(
      RSAPublicKey publicKey, RSAPrivateKey privateKey) {
    return {
      'n': publicKey.modulus!.toRadixString(16),
      'e': publicKey.publicExponent!.toRadixString(16),
      'd': privateKey.privateExponent!.toRadixString(16),
      'p': privateKey.p!.toRadixString(16),
      'q': privateKey.q!.toRadixString(16),
    };
  }

  static (RSAPublicKey, RSAPrivateKey) deserializeKeyPair(Map<String, String> json) {
    final n = BigInt.parse(json['n']!, radix: 16);
    final e = BigInt.parse(json['e']!, radix: 16);
    final d = BigInt.parse(json['d']!, radix: 16);
    final p = BigInt.parse(json['p']!, radix: 16);
    final q = BigInt.parse(json['q']!, radix: 16);
    return (RSAPublicKey(n, e), RSAPrivateKey(n, d, p, q));
  }
}
