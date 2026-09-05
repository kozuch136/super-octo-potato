import '../../models/remote_action.dart';

/// Samsung `KEY_*` remote codes accepted by the Tizen
/// `ms.remote.control` / `SendRemoteKey` WebSocket API (as used by every
/// community Samsung Smart TV remote implementation, e.g. `samsungtvws`,
/// `samsungctl`, Home Assistant's `samsungtv` integration).
class SamsungKeys {
  static const Map<RemoteAction, String> _map = {
    RemoteAction.power: 'KEY_POWER',
    RemoteAction.home: 'KEY_HOME',
    RemoteAction.back: 'KEY_RETURN',
    RemoteAction.up: 'KEY_UP',
    RemoteAction.down: 'KEY_DOWN',
    RemoteAction.left: 'KEY_LEFT',
    RemoteAction.right: 'KEY_RIGHT',
    RemoteAction.select: 'KEY_ENTER',
    RemoteAction.menu: 'KEY_MENU',
    RemoteAction.volumeUp: 'KEY_VOLUP',
    RemoteAction.volumeDown: 'KEY_VOLDOWN',
    RemoteAction.mute: 'KEY_MUTE',
    RemoteAction.channelUp: 'KEY_CHUP',
    RemoteAction.channelDown: 'KEY_CHDOWN',
    RemoteAction.playPause: 'KEY_PLAY',
    RemoteAction.rewind: 'KEY_REWIND',
    RemoteAction.fastForward: 'KEY_FF',
    RemoteAction.mic: 'KEY_VOICE_CONTROL',
    RemoteAction.num0: 'KEY_0',
    RemoteAction.num1: 'KEY_1',
    RemoteAction.num2: 'KEY_2',
    RemoteAction.num3: 'KEY_3',
    RemoteAction.num4: 'KEY_4',
    RemoteAction.num5: 'KEY_5',
    RemoteAction.num6: 'KEY_6',
    RemoteAction.num7: 'KEY_7',
    RemoteAction.num8: 'KEY_8',
    RemoteAction.num9: 'KEY_9',
  };

  static String? codeFor(RemoteAction action) => _map[action];
}
