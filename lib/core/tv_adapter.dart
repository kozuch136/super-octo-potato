import '../models/remote_action.dart';
import '../models/tv_device.dart';

/// Connection lifecycle state shared by every adapter implementation.
enum TvConnectionState { disconnected, connecting, awaitingPairing, connected, error }

/// Result of a pairing attempt, surfaced to the UI.
class PairingResult {
  const PairingResult.success() : ok = true, message = null;
  const PairingResult.failure(this.message) : ok = false;
  final bool ok;
  final String? message;
}

/// Generic error surfaced by any adapter's network/protocol layer.
class TvAdapterException implements Exception {
  TvAdapterException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Common contract every TV backend (Android TV/ADB, Samsung Tizen, LG
/// webOS) implements. The UI and the rest of the app only ever talk to this
/// interface, never to a concrete brand implementation, so a new brand can be
/// added by writing one more adapter.
abstract class TvAdapter {
  TvDevice get device;
  TvConnectionState get state;
  Stream<TvConnectionState> get stateStream;

  /// Opens the network connection. For devices that were already paired this
  /// re-establishes the session using stored secrets; for new devices it may
  /// transition to [TvConnectionState.awaitingPairing] instead.
  Future<void> connect();

  /// Completes pairing for adapters that need an explicit step (e.g.
  /// accepting an on-TV prompt, or a PIN/code). Adapters that pair silently
  /// on [connect] can implement this as a no-op returning success.
  Future<PairingResult> pair({String? code});

  /// Sends one discrete remote action (button press).
  Future<void> sendAction(RemoteAction action);

  /// Sends free-form text to whatever text field is currently focused on the
  /// TV (e.g. a search box), when the protocol supports it.
  Future<void> sendText(String text);

  /// Launches an app by its platform-specific identifier (Android package
  /// name, LG app id, Samsung app id). Returns false if unsupported.
  Future<bool> launchApp(String appId);

  Future<void> disconnect();
}
