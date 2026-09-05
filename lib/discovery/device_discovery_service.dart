import 'dart:async';

import 'discovered_device.dart';
import 'port_scan_discovery.dart';
import 'ssdp_discovery.dart';

/// Combines SSDP (fast, gives friendly names) with a local subnet port scan
/// (catches Android TV/ADB and anything that ignores SSDP) into one
/// deduplicated stream the UI can show as results arrive.
class DeviceDiscoveryService {
  Stream<DiscoveredDevice> discover() {
    final controller = StreamController<DiscoveredDevice>();
    final seen = <String>{};
    var pending = 2;

    void addIfNew(DiscoveredDevice device) {
      if (seen.add('${device.ip}:${device.brand}:${device.port}')) {
        controller.add(device);
      }
    }

    void done() {
      pending--;
      if (pending == 0) controller.close();
    }

    SsdpDiscovery.discover().listen(addIfNew, onError: (_) {}, onDone: done);
    PortScanDiscovery.discover().listen(addIfNew, onError: (_) {}, onDone: done);

    return controller.stream;
  }
}
