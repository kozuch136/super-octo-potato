import 'dart:async';

import 'package:pointycastle/export.dart';

import '../../core/tv_adapter.dart';
import '../../models/remote_action.dart';
import '../../models/tv_device.dart';
import 'adb_crypto.dart';
import 'adb_protocol.dart';
import 'android_keycodes.dart';

/// [TvAdapter] for Android TV / Google TV / Xiaomi Mi Box devices, driven
/// over the network via the ADB (Android Debug Bridge) protocol - the same
/// mechanism `adb connect <ip>:5555` uses. Requires the device's Developer
/// Options -> "Network debugging" (or "ADB debugging" on some Mi Box
/// builds) to be switched on once.
class AdbTvAdapter implements TvAdapter {
  AdbTvAdapter({
    required this.device,
    required Future<Map<String, String>?> Function() loadKeyPair,
    required Future<void> Function(Map<String, String>) saveKeyPair,
  })  : _loadKeyPair = loadKeyPair,
        _saveKeyPair = saveKeyPair;

  @override
  final TvDevice device;

  final Future<Map<String, String>?> Function() _loadKeyPair;
  final Future<void> Function(Map<String, String>) _saveKeyPair;

  final _stateController = StreamController<TvConnectionState>.broadcast();
  TvConnectionState _state = TvConnectionState.disconnected;

  AdbConnection? _connection;
  late RSAPublicKey _publicKey;
  late RSAPrivateKey _privateKey;
  Future<void>? _connecting;

  @override
  TvConnectionState get state => _state;

  @override
  Stream<TvConnectionState> get stateStream => _stateController.stream;

  void _setState(TvConnectionState s) {
    _state = s;
    _stateController.add(s);
  }

  Future<void> _ensureKeyPair() async {
    final stored = await _loadKeyPair();
    if (stored != null) {
      final (pub, priv) = AdbCrypto.deserializeKeyPair(stored);
      _publicKey = pub;
      _privateKey = priv;
      return;
    }
    final pair = AdbCrypto.generateKeyPair();
    _publicKey = pair.publicKey as RSAPublicKey;
    _privateKey = pair.privateKey as RSAPrivateKey;
    await _saveKeyPair(AdbCrypto.serializeKeyPair(_publicKey, _privateKey));
  }

  @override
  Future<void> connect() {
    return _connecting ??= _doConnect().whenComplete(() => _connecting = null);
  }

  Future<void> _doConnect() async {
    _setState(TvConnectionState.connecting);
    try {
      await _ensureKeyPair();
      final connection = AdbConnection();
      _connection = connection;
      await connection.connect(
        device.ip,
        device.port,
        _publicKey,
        _privateKey,
        onPairingPromptSent: () => _setState(TvConnectionState.awaitingPairing),
      );
      _setState(TvConnectionState.connected);
    } catch (_) {
      _setState(TvConnectionState.error);
      rethrow;
    }
  }

  @override
  Future<PairingResult> pair({String? code}) async {
    // Pairing for ADB has no PIN/code: the user must press "Allow" on the
    // TV's own physical remote when the prompt (triggered from connect())
    // appears. We simply (re)run the connect flow and surface the outcome.
    try {
      await connect();
      return const PairingResult.success();
    } on AdbException catch (e) {
      return PairingResult.failure(e.message);
    } catch (e) {
      return PairingResult.failure('$e');
    }
  }

  Future<AdbConnection> _requireConnection() async {
    final c = _connection;
    if (c == null || !c.isConnected) {
      throw AdbException('Urządzenie nie jest połączone.');
    }
    return c;
  }

  @override
  Future<void> sendAction(RemoteAction action) async {
    final keyCode = AndroidKeyCodes.codeFor(action);
    if (keyCode == null) return;
    final connection = await _requireConnection();
    await connection.shellExec('input keyevent $keyCode');
  }

  @override
  Future<void> sendText(String text) async {
    final connection = await _requireConnection();
    final escaped = text.replaceAll("'", r"'\''");
    await connection.shellExec("input text '$escaped'");
  }

  @override
  Future<bool> launchApp(String appId) async {
    final connection = await _requireConnection();
    final output = await connection
        .shellExec('monkey -p $appId -c android.intent.category.LAUNCHER 1');
    return !output.contains('No activities found') && !output.contains('Exception');
  }

  @override
  Future<void> disconnect() async {
    await _connection?.dispose();
    _connection = null;
    _setState(TvConnectionState.disconnected);
  }
}
