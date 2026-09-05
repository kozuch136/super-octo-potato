import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/tv_adapter.dart';
import '../../models/remote_action.dart';
import '../../models/tv_device.dart';
import 'lgwebos_buttons.dart';

/// [TvAdapter] for LG Smart TVs (webOS), using the SSAP (Smart Service
/// Access Protocol) second-screen WebSocket API documented at
/// https://webostv.developer.lge.com (request/response/register envelope),
/// combined with the "pointer input" button socket used by every
/// third-party webOS remote for actual key presses.
class LgWebosTvAdapter implements TvAdapter {
  LgWebosTvAdapter({
    required this.device,
    required Future<String?> Function() loadClientKey,
    required Future<void> Function(String) saveClientKey,
  })  : _loadClientKey = loadClientKey,
        _saveClientKey = saveClientKey;

  @override
  final TvDevice device;

  final Future<String?> Function() _loadClientKey;
  final Future<void> Function(String) _saveClientKey;

  final _stateController = StreamController<TvConnectionState>.broadcast();
  TvConnectionState _state = TvConnectionState.disconnected;

  WebSocket? _commandSocket;
  WebSocket? _pointerSocket;
  StreamSubscription? _commandSub;
  int _requestCounter = 0;
  final Map<String, Completer<Map<String, dynamic>>> _pending = {};
  Completer<String>? _registerCompleter;

  @override
  TvConnectionState get state => _state;
  @override
  Stream<TvConnectionState> get stateStream => _stateController.stream;

  void _setState(TvConnectionState s) {
    _state = s;
    _stateController.add(s);
  }

  static const _manifest = {
    'manifestVersion': 1,
    'appVersion': '1.0',
    'permissions': [
      'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'CONTROL_AUDIO',
      'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_PLAYBACK',
      'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS',
      'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATE',
      'READ_RUNNING_APPS', 'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST',
      'READ_POWER_STATE', 'READ_COUNTRY_INFO', 'CONTROL_INPUT_TEXT',
      'CONTROL_MOUSE_AND_KEYBOARD', //
    ],
  };

  Future<WebSocket> _openSocket(String url) {
    final client = HttpClient()
      ..badCertificateCallback = (cert, host, port) => true; // self-signed TV cert
    return WebSocket.connect(url, customClient: client)
        .timeout(const Duration(seconds: 8));
  }

  @override
  Future<void> connect() async {
    _setState(TvConnectionState.connecting);
    try {
      WebSocket socket;
      try {
        socket = await _openSocket('wss://${device.ip}:${device.port}');
      } catch (_) {
        // Older / plain-mode sets expose the unencrypted port instead.
        socket = await _openSocket('ws://${device.ip}:3000');
      }
      _commandSocket = socket;
      _commandSub = socket.listen(_onMessage, onDone: _onDone, onError: (_) {});

      final storedKey = await _loadClientKey();
      final clientKey = await _register(storedKey);
      await _saveClientKey(clientKey);

      _setState(TvConnectionState.connected);
    } catch (e) {
      _setState(TvConnectionState.error);
      rethrow;
    }
  }

  Future<String> _register(String? existingKey) async {
    _registerCompleter = Completer<String>();
    final payload = {
      'forcePairing': false,
      'pairingType': 'PROMPT',
      'manifest': _manifest,
      if (existingKey != null) 'client-key': existingKey,
    };
    _sendRaw({'type': 'register', 'id': 'register_0', 'payload': payload});

    if (existingKey == null) {
      _setState(TvConnectionState.awaitingPairing);
    }
    return _registerCompleter!.future.timeout(const Duration(seconds: 60));
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) return;
    Map<String, dynamic> msg;
    try {
      msg = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final type = msg['type'] as String?;
    final id = msg['id'] as String?;

    if (id == 'register_0') {
      if (type == 'registered') {
        final key = (msg['payload'] as Map)['client-key'] as String;
        _registerCompleter?.complete(key);
      } else if (type == 'error') {
        _registerCompleter?.completeError(TvAdapterException('${msg['error']}'));
      }
      return;
    }

    if (id != null && _pending.containsKey(id)) {
      final completer = _pending.remove(id)!;
      if (type == 'error') {
        completer.completeError(TvAdapterException('${msg['error']}'));
      } else {
        completer.complete((msg['payload'] as Map?)?.cast<String, dynamic>() ?? {});
      }
    }
  }

  void _onDone() {
    if (_registerCompleter != null && !_registerCompleter!.isCompleted) {
      _registerCompleter!.completeError(TvAdapterException('Połączenie zamknięte.'));
    }
  }

  void _sendRaw(Map<String, dynamic> message) {
    _commandSocket?.add(jsonEncode(message));
  }

  Future<Map<String, dynamic>> _request(String uri, [Map<String, dynamic>? payload]) {
    final id = 'req_${_requestCounter++}';
    final completer = Completer<Map<String, dynamic>>();
    _pending[id] = completer;
    _sendRaw({'type': 'request', 'id': id, 'uri': uri, 'payload': payload ?? {}});
    return completer.future.timeout(const Duration(seconds: 8), onTimeout: () {
      _pending.remove(id);
      throw TvAdapterException('Timeout dla $uri');
    });
  }

  Future<WebSocket> _ensurePointerSocket() async {
    final existing = _pointerSocket;
    if (existing != null) return existing;
    final res = await _request('ssap://com.webos.service.networkinput/getPointerInputSocket');
    final socketPath = res['socketPath'] as String;
    final socket = await _openSocket(socketPath);
    _pointerSocket = socket;
    return socket;
  }

  @override
  Future<PairingResult> pair({String? code}) async {
    try {
      await connect();
      return const PairingResult.success();
    } catch (e) {
      return PairingResult.failure('$e');
    }
  }

  @override
  Future<void> sendAction(RemoteAction action) async {
    if (action == RemoteAction.power) {
      await _request('ssap://system/turnOff');
      return;
    }
    final name = LgWebosButtons.nameFor(action);
    if (name == null) return;
    final socket = await _ensurePointerSocket();
    socket.add('type:button\nname:$name\n\n');
  }

  @override
  Future<void> sendText(String text) async {
    await _request('ssap://com.webos.service.ime/insertText', {
      'text': text,
      'replace': 0,
    });
  }

  @override
  Future<bool> launchApp(String appId) async {
    try {
      await _request('ssap://system.launcher/launch', {'id': appId});
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> disconnect() async {
    await _commandSub?.cancel();
    await _commandSocket?.close();
    await _pointerSocket?.close();
    _commandSocket = null;
    _pointerSocket = null;
    _setState(TvConnectionState.disconnected);
  }
}
