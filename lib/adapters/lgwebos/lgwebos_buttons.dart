import '../../models/remote_action.dart';

/// Button names accepted by the webOS "pointer input" socket, as used by the
/// long-standing community webOS remote implementations (`lgtv2`,
/// `bscpylgtv`, Home Assistant's `webostv` integration) that third-party
/// (non-signed) apps rely on, since LG's own SSAP reference at
/// https://webostv.developer.lge.com documents the request/response
/// envelope but not this specific button vocabulary.
class LgWebosButtons {
  static const Map<RemoteAction, String> _map = {
    RemoteAction.home: 'HOME',
    RemoteAction.back: 'BACK',
    RemoteAction.select: 'ENTER',
    RemoteAction.up: 'UP',
    RemoteAction.down: 'DOWN',
    RemoteAction.left: 'LEFT',
    RemoteAction.right: 'RIGHT',
    RemoteAction.menu: 'MENU',
    RemoteAction.volumeUp: 'VOLUMEUP',
    RemoteAction.volumeDown: 'VOLUMEDOWN',
    RemoteAction.mute: 'MUTE',
    RemoteAction.channelUp: 'CHANNELUP',
    RemoteAction.channelDown: 'CHANNELDOWN',
    RemoteAction.playPause: 'PLAY',
    RemoteAction.rewind: 'REWIND',
    RemoteAction.fastForward: 'FASTFORWARD',
    RemoteAction.num0: '0',
    RemoteAction.num1: '1',
    RemoteAction.num2: '2',
    RemoteAction.num3: '3',
    RemoteAction.num4: '4',
    RemoteAction.num5: '5',
    RemoteAction.num6: '6',
    RemoteAction.num7: '7',
    RemoteAction.num8: '8',
    RemoteAction.num9: '9',
  };

  static String? nameFor(RemoteAction action) => _map[action];
}
