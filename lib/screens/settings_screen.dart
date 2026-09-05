import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ustawienia')),
      body: ListView(
        children: [
          const ListTile(
            leading: Icon(Icons.block),
            title: Text('Bez reklam'),
            subtitle: Text('Aplikacja nie zawiera reklam, telemetrii ani śledzenia - działa wyłącznie lokalnie w Twojej sieci WiFi.'),
          ),
          const Divider(),
          const ListTile(
            leading: Icon(Icons.wifi),
            title: Text('Jak to działa'),
            subtitle: Text(
              'Android TV/Google TV: protokół ADB po sieci (port 5555).\n'
              'Samsung: WebSocket "samsung.remote.control" (port 8001/8002).\n'
              'LG: SSAP przez WebSocket (port 3000/3001).',
            ),
          ),
          const Divider(),
          FutureBuilder<PackageInfo>(
            future: PackageInfo.fromPlatform(),
            builder: (context, snapshot) {
              final version = snapshot.data?.version ?? '-';
              return ListTile(
                leading: const Icon(Icons.info_outline),
                title: const Text('Wersja aplikacji'),
                subtitle: Text(version),
              );
            },
          ),
        ],
      ),
    );
  }
}
