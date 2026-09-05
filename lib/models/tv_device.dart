import 'tv_brand.dart';

/// A TV/box the user has discovered and/or paired with. Persisted (minus
/// secrets, which live in secure storage) so it survives app restarts.
class TvDevice {
  TvDevice({
    required this.id,
    required this.name,
    required this.ip,
    required this.brand,
    int? port,
    this.paired = false,
  }) : port = port ?? brand.defaultPort;

  final String id;
  final String name;
  final String ip;
  final TvBrand brand;
  final int port;

  /// Whether a successful pairing/handshake has completed at least once.
  /// When true, the app skips the pairing screen and connects directly.
  final bool paired;

  TvDevice copyWith({
    String? name,
    String? ip,
    int? port,
    bool? paired,
  }) {
    return TvDevice(
      id: id,
      name: name ?? this.name,
      ip: ip ?? this.ip,
      brand: brand,
      port: port ?? this.port,
      paired: paired ?? this.paired,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'ip': ip,
        'brand': brand.name,
        'port': port,
        'paired': paired,
      };

  factory TvDevice.fromJson(Map<String, dynamic> json) => TvDevice(
        id: json['id'] as String,
        name: json['name'] as String,
        ip: json['ip'] as String,
        brand: TvBrand.values.byName(json['brand'] as String),
        port: json['port'] as int,
        paired: json['paired'] as bool? ?? false,
      );
}
