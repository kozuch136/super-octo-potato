import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/tv_device.dart';
import '../services/remote_manager.dart';
import '../widgets/device_tile.dart';
import 'add_device_screen.dart';
import 'pairing_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RemoteManager>().loadDevices();
    });
  }

  Future<void> _openDevice(TvDevice device) async {
    final manager = context.read<RemoteManager>();
    await manager.connect(device);
    if (!mounted) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PairingScreen(device: device),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final manager = context.watch<RemoteManager>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pilot WiFi'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: manager.devices.isEmpty
          ? _EmptyState(onAdd: () => _goToAddDevice(context))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final device in manager.devices)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: DeviceTile(
                      device: device,
                      onTap: () => _openDevice(device),
                      onDelete: () => manager.removeDevice(device.id),
                    ),
                  ),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _goToAddDevice(context),
        icon: const Icon(Icons.add),
        label: const Text('Dodaj telewizor'),
      ),
    );
  }

  void _goToAddDevice(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddDeviceScreen()));
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.tv_outlined,
                size: 72, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6)),
            const SizedBox(height: 16),
            Text('Brak dodanych telewizorów', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Dodaj Android TV, Samsung lub LG w tej samej sieci WiFi.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add),
              label: const Text('Dodaj telewizor'),
            ),
          ],
        ),
      ),
    );
  }
}
