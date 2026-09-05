import 'dart:async';
import 'dart:io';

import '../models/tv_brand.dart';
import 'discovered_device.dart';
import 'network_utils.dart';

/// Fallback discovery for devices that don't answer SSDP - most notably
/// Android TV / Google TV boxes exposing only the ADB port. Sweeps the
/// local /24 subnet for the well-known ports of each supported brand.
class PortScanDiscovery {
  static const _candidatePorts = <int, TvBrand>{
    5555: TvBrand.androidTv,
    8001: TvBrand.samsung,
    8002: TvBrand.samsung,
    3000: TvBrand.lg,
    3001: TvBrand.lg,
  };

  static Stream<DiscoveredDevice> discover({
    Duration perHostTimeout = const Duration(milliseconds: 400),
    int concurrency = 32,
  }) {
    final controller = StreamController<DiscoveredDevice>();

    () async {
      try {
        final locals = await NetworkUtils.localIPv4Addresses();
        if (locals.isEmpty) {
          await controller.close();
          return;
        }
        final prefix = NetworkUtils.subnetPrefix(locals.first);

        final hosts = List.generate(254, (i) => '$prefix.${i + 1}');
        var index = 0;

        Future<void> worker() async {
          while (index < hosts.length) {
            final host = hosts[index++];
            if (locals.contains(host)) continue;
            for (final entry in _candidatePorts.entries) {
              try {
                final socket = await Socket.connect(host, entry.key, timeout: perHostTimeout);
                socket.destroy();
                controller.add(DiscoveredDevice(ip: host, brand: entry.value, port: entry.key));
              } catch (_) {
                // Closed/filtered port or host down - expected for most of
                // the subnet, not an error worth surfacing.
              }
            }
          }
        }

        await Future.wait(List.generate(concurrency, (_) => worker()));
      } catch (e) {
        controller.addError(e);
      } finally {
        await controller.close();
      }
    }();

    return controller.stream;
  }
}
