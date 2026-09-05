import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/tv_adapter.dart';
import '../../models/remote_action.dart';
import '../../models/tv_device.dart';
import 'samsung_keys.dart';

/// [TvAdapter] for Samsung Smart TVs (Tizen, 2018+) using the local
/// `ms.remote.control` WebSocket API on `/api/v2/channels/samsung.remote.control`
/// (port 8002 TLS / 8001 plain), the same one used by Samsung's own
/// SmartThings/"Smart View" app and documented by community libraries such
/// as `samsungtvws` and Home Assistant's `samsungtv` integration.
///
/// Note: 2016-2017 Tizen sets used a different, PIN-based legacy pairing
/// protocol on port 8080 that is not implemented here.
class SamsungTvAdapter implements TvAdapter {
  SamsungTvAdapter({
    required this.device,
    required Future<String?> Function() loadToken,
    required Future<void> Function(String) saveToken,
  })  : _loadToken = loadToken,
        _saveToken = saveToken;

  @override
  final TvDevice device;

  final Future<String?> Function() _loadToken;
  final Future<void> Function(String) _saveToken;

  final _stateController = StreamController<TvConnectionState>.broadcast();
  TvConnectionState _state = TvConnectionState.disconnected;

  WebSocket? _socket;
  StreamSubscription? _sub;
  bool _firstTextSent = false;
  Completer<void>? _handshakeCompleter;

  @override
  TvConnectionState get state => _state;
  @override
  Stream<TvConnectionState> get stateStream => _stateController.stream;

  void _setState(TvConnectionState s) {
    _state = s;
    _stateController.add(s);
  }

  @override
  Future<void> connect() async {
    _setState(TvConnectionState.connecting);
    try {
      final token = await _loadToken();
      final name = base64.encode(utf8.encode('WiFi TV Remote'));
      final query = StringBuffer('name=$name');
      if (token != null) query.write('&token=$token');

      final client = HttpClient()
        ..badCertificateCallback = (cert, host, port) => true; // self-signed TV cert

      WebSocket socket;
      try {
        socket = await WebSocket.connect(
          'wss://${device.ip}:8002/api/v2/channels/samsung.remote.control?$query',
          customClient: client,
        ).timeout(const Duration(seconds: 8));
      } catch (_) {
        socket = await WebSocket.connect(
          'ws://${device.ip}:8001/api/v2/channels/samsung.remote.control?name=$name',
        ).timeout(const Duration(seconds: 8));
      }
      _socket = socket;

      _handshakeCompleter = Completer<void>();
      if (token == null) _setState(TvConnectionState.awaitingPairing);
      _sub = socket.listen(_onMessage, onDone: _onDone, onError: (_) {});

      await _handshakeCompleter!.future.timeout(const Duration(seconds: 60));
      _setState(TvConnectionState.connected);
    } catch (e) {
      _setState(TvConnectionState.error);
      rethrow;
    }
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) return;
    Map<String, dynamic> msg;
    try {
      msg = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final event = msg['event'] as String?;
    if (event == 'ms.channel.connect') {
      final data = msg['data'] as Map<String, dynamic>?;
      final token = data?['token'] as String?;
      if (token != null) {
        _saveToken(token);
      }
      if (!(_handshakeCompleter?.isCompleted ?? true)) {
        _handshakeCompleter!.complete();
      }
    } else if (event == 'ms.channel.unauthorized' || event == 'ms.channel.timeOut') {
      if (!(_handshakeCompleter?.isCompleted ?? true)) {
        _handshakeCompleter!.completeError(
            TvAdapterException('Odrzucono parowanie na telewizorze.'));
      }
    }
  }

  void _onDone() {
    if (!(_handshakeCompleter?.isCompleted ?? true)) {
      _handshakeCompleter!.completeError(TvAdapterException('Połączenie zamknięte.'));
    }
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

  void _sendCommand(Map<String, dynamic> params) {
    final socket = _socket;
    if (socket == null) throw TvAdapterException('Urządzenie nie jest połączone.');
    socket.add(jsonEncode({'method': 'ms.remote.control', 'params': params}));
  }

  @override
  Future<void> sendAction(RemoteAction action) async {
    final key = SamsungKeys.codeFor(action);
    if (key == null) return;
    _sendCommand({
      'Cmd': 'Click',
      'DataOfCmd': key,
      'Option': 'false',
      'TypeOfRemote': 'SendRemoteKey',
    });
  }

  @override
  Future<void> sendText(String text) async {
    if (text.isEmpty) return;
    if (!_firstTextSent) {
      // Some firmware versions need one throwaway broadcast before they
      // start accepting SendInputString commands.
      _sendCommand({
        'Cmd': 'text_received',
        'TypeOfRemote': 'SendInputEnd',
      });
      _firstTextSent = true;
    }
    _sendCommand({
      'Cmd': base64.encode(utf8.encode(text)),
      'DataOfCmd': 'base64',
      'TypeOfRemote': 'SendInputString',
    });
  }

  @override
  Future<bool> launchApp(String appId) async {
    try {
      final client = HttpClient()
        ..badCertificateCallback = (cert, host, port) => true
        ..connectionTimeout = const Duration(seconds: 5);
      final request = await client.postUrl(
          Uri.parse('http://${device.ip}:8001/api/v2/applications/$appId'));
      final response = await request.close();
      client.close();
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> disconnect() async {
    await _sub?.cancel();
    await _socket?.close();
    _socket = null;
    _setState(TvConnectionState.disconnected);
  }
}
