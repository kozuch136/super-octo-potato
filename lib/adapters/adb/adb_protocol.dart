import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

import 'adb_crypto.dart';

/// Thrown for any ADB-transport-level failure.
class AdbException implements Exception {
  AdbException(this.message);
  final String message;
  @override
  String toString() => 'AdbException: $message';
}

/// The 4-byte ADB command identifiers. Per the AOSP protocol docs
/// (`system/core/adb/protocol.txt`), each command is an ASCII 4-character
/// tag interpreted as a little-endian uint32 - computed here at runtime
/// instead of hard-coded magic numbers to avoid transcription mistakes.
class _AdbCmd {
  static int _of(String s) {
    final b = s.codeUnits;
    return b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
  }

  static final int cnxn = _of('CNXN');
  static final int auth = _of('AUTH');
  static final int open = _of('OPEN');
  static final int okay = _of('OKAY');
  static final int wrte = _of('WRTE');
  static final int clse = _of('CLSE');
}

/// AUTH sub-types, carried in `arg0` of an AUTH packet.
class AdbAuthType {
  static const int token = 1;
  static const int signature = 2;
  static const int rsaPublicKey = 3;
}

class AdbMessage {
  AdbMessage(this.command, this.arg0, this.arg1, this.data);

  final int command;
  final int arg0;
  final int arg1;
  final Uint8List data;

  Uint8List encode() {
    final header = ByteData(24);
    header.setUint32(0, command, Endian.little);
    header.setUint32(4, arg0, Endian.little);
    header.setUint32(8, arg1, Endian.little);
    header.setUint32(12, data.length, Endian.little);
    header.setUint32(16, _checksum(data), Endian.little);
    // "magic" = command XOR 0xFFFFFFFF, per the ADB protocol spec.
    header.setUint32(20, command ^ 0xFFFFFFFF, Endian.little);
    final out = BytesBuilder();
    out.add(header.buffer.asUint8List());
    out.add(data);
    return out.toBytes();
  }

  /// The classic ADB "checksum" is documented to be the simple sum of all
  /// data bytes (mod 2^32) - not an actual CRC32, despite the field name.
  static int _checksum(Uint8List data) {
    var sum = 0;
    for (final b in data) {
      sum = (sum + b) & 0xFFFFFFFF;
    }
    return sum;
  }
}

class _AdbStream {
  _AdbStream(this.localId);
  final int localId;
  int? remoteId;
  final opened = Completer<void>();
  final closed = Completer<void>();
  final incoming = StreamController<Uint8List>.broadcast();
}

/// A single persistent connection to an `adbd` instance (Android TV / Google
/// TV / Mi Box exposing "Network debugging" on TCP port 5555), implementing
/// just enough of the ADB protocol (CNXN/AUTH handshake plus OPEN/WRTE/
/// OKAY/CLSE stream multiplexing for the `shell:` service) to run one-shot
/// shell commands such as `input keyevent`.
///
/// Reference: AOSP `system/core/adb/protocol.txt` and
/// `system/core/adb/OVERVIEW.TXT`.
class AdbConnection {
  Socket? _socket;
  final List<int> _readBuffer = [];
  final Map<int, _AdbStream> _streams = {};
  int _nextLocalId = 1;
  int _authAttempts = 0;
  final _connected = Completer<void>();
  StreamSubscription<Uint8List>? _sub;

  late RSAPublicKey _publicKey;
  late RSAPrivateKey _privateKey;
  void Function()? onPairingPromptSent;

  bool get isConnected => _socket != null && _connected.isCompleted;

  /// Opens the TCP connection and drives the CNXN/AUTH handshake to
  /// completion. If the device does not already trust our key, this sends
  /// the RSA public key (triggering the on-TV "Allow debugging?" prompt),
  /// invokes [onPairingPromptSent], and keeps waiting - the caller should
  /// pass a generous [timeout] (the user has to walk over and click Allow).
  Future<void> connect(
    String host,
    int port,
    RSAPublicKey publicKey,
    RSAPrivateKey privateKey, {
    Duration timeout = const Duration(seconds: 60),
    void Function()? onPairingPromptSent,
  }) async {
    _publicKey = publicKey;
    _privateKey = privateKey;
    this.onPairingPromptSent = onPairingPromptSent;

    _socket = await Socket.connect(host, port,
        timeout: const Duration(seconds: 10));
    _socket!.setOption(SocketOption.tcpNoDelay, true);
    _sub = _socket!.listen(_onData, onDone: _onDone, onError: _onError, cancelOnError: true);

    _send(AdbMessage(_AdbCmd.cnxn, 0x01000000, 1048576,
        Uint8List.fromList(utf8.encode('host::wifi-tv-remote\u0000'))));

    return _connected.future.timeout(timeout, onTimeout: () {
      dispose();
      throw AdbException(
          'Nie otrzymano potwierdzenia połączenia (CNXN) w wyznaczonym czasie.');
    });
  }

  void _send(AdbMessage m) {
    final socket = _socket;
    if (socket == null) return;
    socket.add(m.encode());
  }

  void _onData(Uint8List chunk) {
    _readBuffer.addAll(chunk);
    while (true) {
      if (_readBuffer.length < 24) return;
      final header = Uint8List.fromList(_readBuffer.sublist(0, 24));
      final bd = ByteData.sublistView(header);
      final command = bd.getUint32(0, Endian.little);
      final arg0 = bd.getUint32(4, Endian.little);
      final arg1 = bd.getUint32(8, Endian.little);
      final dataLen = bd.getUint32(12, Endian.little);
      if (_readBuffer.length < 24 + dataLen) return;
      final data = Uint8List.fromList(_readBuffer.sublist(24, 24 + dataLen));
      _readBuffer.removeRange(0, 24 + dataLen);
      _handleMessage(command, arg0, arg1, data);
    }
  }

  void _handleMessage(int command, int arg0, int arg1, Uint8List data) {
    if (command == _AdbCmd.cnxn) {
      if (!_connected.isCompleted) _connected.complete();
      return;
    }
    if (command == _AdbCmd.auth) {
      if (arg0 == AdbAuthType.token) {
        _authAttempts++;
        if (_authAttempts == 1) {
          final sig = AdbCrypto.signToken(_privateKey, data);
          _send(AdbMessage(_AdbCmd.auth, AdbAuthType.signature, 0, sig));
        } else {
          final pubKeyStr = AdbCrypto.encodePublicKey(_publicKey);
          _send(AdbMessage(_AdbCmd.auth, AdbAuthType.rsaPublicKey, 0,
              Uint8List.fromList(utf8.encode('$pubKeyStr\u0000'))));
          onPairingPromptSent?.call();
        }
      }
      return;
    }

    final stream = _streams[arg1];
    if (command == _AdbCmd.okay) {
      if (stream != null) {
        stream.remoteId = arg0;
        if (!stream.opened.isCompleted) stream.opened.complete();
      }
      return;
    }
    if (command == _AdbCmd.wrte) {
      if (stream != null) {
        stream.incoming.add(data);
        _send(AdbMessage(
            _AdbCmd.okay, stream.localId, stream.remoteId ?? arg0, Uint8List(0)));
      }
      return;
    }
    if (command == _AdbCmd.clse) {
      if (stream != null) {
        if (!stream.closed.isCompleted) stream.closed.complete();
        stream.incoming.close();
        _streams.remove(arg1);
      }
      return;
    }
  }

  void _onDone() {
    if (!_connected.isCompleted) {
      _connected.completeError(AdbException('Połączenie zamknięte przez urządzenie.'));
    }
    for (final s in _streams.values) {
      if (!s.closed.isCompleted) {
        s.closed.completeError(AdbException('Połączenie przerwane.'));
      }
    }
  }

  void _onError(Object error) {
    if (!_connected.isCompleted) {
      _connected.completeError(AdbException('Błąd sieci: $error'));
    }
  }

  /// Runs `command` via the ADB `shell:` service and returns whatever the
  /// remote shell wrote to stdout/stderr (best-effort, UTF-8 decoded).
  Future<String> shellExec(String command,
      {Duration timeout = const Duration(seconds: 5)}) async {
    if (!isConnected) {
      throw AdbException('Brak aktywnego połączenia ADB.');
    }
    final localId = _nextLocalId++;
    final stream = _AdbStream(localId);
    _streams[localId] = stream;

    _send(AdbMessage(_AdbCmd.open, localId, 0,
        Uint8List.fromList(utf8.encode('shell:$command\u0000'))));

    try {
      await stream.opened.future.timeout(timeout);
    } on TimeoutException {
      _streams.remove(localId);
      throw AdbException('Timeout przy otwieraniu strumienia shell.');
    }

    final output = BytesBuilder();
    final sub = stream.incoming.stream.listen(output.add);
    try {
      await stream.closed.future.timeout(timeout, onTimeout: () {});
    } finally {
      await sub.cancel();
      if (!stream.closed.isCompleted) {
        _send(AdbMessage(_AdbCmd.clse, localId, stream.remoteId ?? 0, Uint8List(0)));
      }
      _streams.remove(localId);
    }
    return utf8.decode(output.toBytes(), allowMalformed: true);
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    for (final s in _streams.values) {
      if (!s.closed.isCompleted) s.closed.complete();
      s.incoming.close();
    }
    _streams.clear();
    await _socket?.close();
    _socket = null;
  }
}
