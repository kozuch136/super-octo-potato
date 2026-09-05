import '../models/tv_brand.dart';

/// A device found on the local network, before the user has confirmed it
/// and it becomes a persisted [TvDevice].
class DiscoveredDevice {
  DiscoveredDevice({
    required this.ip,
    required this.brand,
    required this.port,
    this.name,
  });

  final String ip;
  final TvBrand brand;
  final int port;
  final String? name;

  String get displayName => name ?? '${brand.label} ($ip)';

  @override
  bool operator ==(Object other) =>
      other is DiscoveredDevice && other.ip == ip && other.brand == brand;

  @override
  int get hashCode => Object.hash(ip, brand);
}
