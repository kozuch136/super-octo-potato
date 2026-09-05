/// Supported TV backends. Each brand maps to one [TvAdapter] implementation.
enum TvBrand {
  /// Android TV / Google TV (e.g. Xiaomi Mi Box, Nvidia Shield, Chromecast
  /// with Google TV, Sony/TCL Android TV). Controlled over the network via
  /// the Android Debug Bridge (ADB) protocol, the same mechanism used by
  /// `adb connect <ip>:5555`.
  androidTv,

  /// Samsung Smart TV (Tizen OS, 2016+). Controlled via Samsung's local
  /// WebSocket remote-control API.
  samsung,

  /// LG Smart TV (webOS). Controlled via the webOS Second-Screen SSAP
  /// (Smart Service Access Protocol) over WebSocket.
  lg,
}

extension TvBrandX on TvBrand {
  String get label => switch (this) {
        TvBrand.androidTv => "Android TV / Google TV",
        TvBrand.samsung => "Samsung (Tizen)",
        TvBrand.lg => "LG (webOS)",
      };

  /// Default TCP port used for discovery / first connection attempt.
  int get defaultPort => switch (this) {
        TvBrand.androidTv => 5555,
        TvBrand.samsung => 8002,
        TvBrand.lg => 3001,
      };
}
