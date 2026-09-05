/// Brand-agnostic remote control action. Every [TvAdapter] translates these
/// into whatever wire format its protocol expects (Android KeyEvent codes,
/// LG webOS button names, Samsung KEY_* codes, ...).
enum RemoteAction {
  power,
  home,
  back,
  up,
  down,
  left,
  right,
  select, // OK / center / enter
  menu,
  volumeUp,
  volumeDown,
  mute,
  channelUp,
  channelDown,
  playPause,
  rewind,
  fastForward,
  mic, // voice assistant / search
  num0,
  num1,
  num2,
  num3,
  num4,
  num5,
  num6,
  num7,
  num8,
  num9,
}
