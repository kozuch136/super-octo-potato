import 'dart:async';
import 'dart:io';

import '../models/tv_brand.dart';
import 'discovered_device.dart';

/// SSDP (Simple Service Discovery Protocol, UPnP) multicast discovery.
/// Most Samsung and LG smart TVs - and many Android TV / Google TV boxes
/// that support casting (DIAL) - answer the standard `M-SEARCH` multicast
/// query on 239.255.255.250:1900 with headers hinting at the brand.
class SsdpDiscovery {
  static const _multicastAddress = '239.255.255.250';
  static const _multicastPort = 1900;

  static Stream<DiscoveredDevice> discover({
    Duration searchTime = const Duration(seconds: 4),
  }) {
    final controller = StreamController<DiscoveredDevice>();
    final seen = <String>{};

    () async {
      RawDatagramSocket? socket;
      try {
        socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
        socket.broadcastEnabled = true;

        const request = 'M-SEARCH * HTTP/1.1\r\n'
            'HOST: 239.255.255.250:1900\r\n'
            'MAN: "ssdp:discover"\r\n'
            'MX: 3\r\n'
            'ST: ssdp:all\r\n'
            '\r\n';
        final requestBytes = request.codeUnits;
        final target = InternetAddress(_multicastAddress);

        final sub = socket.listen((event) {
          if (event != RawSocketEvent.read) return;
          final datagram = socket!.receive();
          if (datagram == null) return;
          final response = String.fromCharCodes(datagram.data);
          final device = _parseResponse(datagram.address.address, response);
          if (device != null && seen.add('${device.ip}:${device.brand}')) {
            controller.add(device);
          }
        });

        // Send a few bursts, as UDP is unreliable and MX asks devices to
        // spread out their replies over a few seconds.
        for (var i = 0; i < 3; i++) {
          socket.send(requestBytes, target, _multicastPort);
          await Future<void>.delayed(const Duration(milliseconds: 300));
        }

        await Future<void>.delayed(searchTime);
        await sub.cancel();
      } catch (e) {
        controller.addError(e);
      } finally {
        socket?.close();
        await controller.close();
      }
    }();

    return controller.stream;
  }

  static DiscoveredDevice? _parseResponse(String ip, String raw) {
    final lower = raw.toLowerCase();
    TvBrand? brand;
    if (lower.contains('tizen') || lower.contains('samsung')) {
      brand = TvBrand.samsung;
    } else if (lower.contains('webos') || lower.contains('lgsmarttv') || lower.contains('lg electronics')) {
      brand = TvBrand.lg;
    } else if (lower.contains('chromecast') || lower.contains('crkey') || lower.contains('android') || lower.contains('google')) {
      brand = TvBrand.androidTv;
    }
    if (brand == null) return null;

    String? friendlyName;
    for (final line in raw.split('\r\n')) {
      final idx = line.indexOf(':');
      if (idx <= 0) continue;
      final key = line.substring(0, idx).trim().toUpperCase();
      final value = line.substring(idx + 1).trim();
      if (key == 'SERVER' || key == 'USN') {
        friendlyName ??= value;
      }
    }

    return DiscoveredDevice(ip: ip, brand: brand, port: brand.defaultPort, name: friendlyName);
  }
}
