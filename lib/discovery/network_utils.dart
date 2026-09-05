import 'dart:io';

/// Small helpers for figuring out "my own" local network so we know which
/// /24 subnet to sweep when looking for TVs.
class NetworkUtils {
  /// Returns this device's IPv4 addresses on Wi-Fi/Ethernet interfaces
  /// (loopback and link-local excluded).
  static Future<List<String>> localIPv4Addresses() async {
    final interfaces = await NetworkInterface.list(
      type: InternetAddressType.IPv4,
      includeLoopback: false,
      includeLinkLocal: false,
    );
    return [
      for (final iface in interfaces)
        for (final addr in iface.addresses) addr.address,
    ];
  }

  /// Given `192.168.1.42`, returns `192.168.1` so callers can sweep
  /// `192.168.1.1` .. `192.168.1.254`. Assumes the common /24 home network
  /// case; larger/segmented networks are out of scope for auto-discovery
  /// (the user can always add a device by IP manually).
  static String subnetPrefix(String ipv4) {
    final parts = ipv4.split('.');
    if (parts.length != 4) return ipv4;
    return '${parts[0]}.${parts[1]}.${parts[2]}';
  }
}
