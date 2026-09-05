import '../../models/remote_action.dart';

/// Android `KeyEvent` integer codes, as documented at
/// https://developer.android.com/reference/android/view/KeyEvent - these are
/// what `adb shell input keyevent <code>` (and Android TV's remote pipeline)
/// expect.
class AndroidKeyCodes {
  static const Map<RemoteAction, int> _map = {
    RemoteAction.power: 26, // KEYCODE_POWER
    RemoteAction.home: 3, // KEYCODE_HOME
    RemoteAction.back: 4, // KEYCODE_BACK
    RemoteAction.up: 19, // KEYCODE_DPAD_UP
    RemoteAction.down: 20, // KEYCODE_DPAD_DOWN
    RemoteAction.left: 21, // KEYCODE_DPAD_LEFT
    RemoteAction.right: 22, // KEYCODE_DPAD_RIGHT
    RemoteAction.select: 23, // KEYCODE_DPAD_CENTER
    RemoteAction.menu: 82, // KEYCODE_MENU
    RemoteAction.volumeUp: 24, // KEYCODE_VOLUME_UP
    RemoteAction.volumeDown: 25, // KEYCODE_VOLUME_DOWN
    RemoteAction.mute: 164, // KEYCODE_VOLUME_MUTE
    RemoteAction.channelUp: 166, // KEYCODE_CHANNEL_UP
    RemoteAction.channelDown: 167, // KEYCODE_CHANNEL_DOWN
    RemoteAction.playPause: 85, // KEYCODE_MEDIA_PLAY_PAUSE
    RemoteAction.rewind: 89, // KEYCODE_MEDIA_REWIND
    RemoteAction.fastForward: 90, // KEYCODE_MEDIA_FAST_FORWARD
    RemoteAction.mic: 84, // KEYCODE_SEARCH (voice/search entry point)
    RemoteAction.num0: 7,
    RemoteAction.num1: 8,
    RemoteAction.num2: 9,
    RemoteAction.num3: 10,
    RemoteAction.num4: 11,
    RemoteAction.num5: 12,
    RemoteAction.num6: 13,
    RemoteAction.num7: 14,
    RemoteAction.num8: 15,
    RemoteAction.num9: 16,
  };

  static int? codeFor(RemoteAction action) => _map[action];
}
