import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../discovery/device_discovery_service.dart';
import '../discovery/discovered_device.dart';
import '../models/tv_brand.dart';
import '../models/tv_device.dart';
import '../services/remote_manager.dart';

class AddDeviceScreen extends StatefulWidget {
  const AddDeviceScreen({super.key});

  @override
  State<AddDeviceScreen> createState() => _AddDeviceScreenState();
}

class _AddDeviceScreenState extends State<AddDeviceScreen> {
  final _discovered = <DiscoveredDevice>[];
  bool _scanning = true;

  final _nameController = TextEditingController();
  final _ipController = TextEditingController();
  TvBrand _manualBrand = TvBrand.androidTv;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _startScan();
  }

  void _startScan() {
    setState(() {
      _discovered.clear();
      _scanning = true;
    });
    DeviceDiscoveryService().discover().listen(
      (device) {
        if (!mounted) return;
        setState(() => _discovered.add(device));
      },
      onDone: () {
        if (mounted) setState(() => _scanning = false);
      },
      onError: (_) {
        if (mounted) setState(() => _scanning = false);
      },
    );
  }

  Future<void> _addAndOpen(TvDevice device) async {
    await context.read<RemoteManager>().addDevice(device);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  void _addDiscovered(DiscoveredDevice d) {
    _addAndOpen(TvDevice(
      id: const Uuid().v4(),
      name: d.displayName,
      ip: d.ip,
      brand: d.brand,
      port: d.port,
    ));
  }

  void _submitManual() {
    if (!_formKey.currentState!.validate()) return;
    _addAndOpen(TvDevice(
      id: const Uuid().v4(),
      name: _nameController.text.trim().isEmpty
          ? _manualBrand.label
          : _nameController.text.trim(),
      ip: _ipController.text.trim(),
      brand: _manualBrand,
    ));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ipController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dodaj telewizor')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Text('Wykryte w sieci', style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              if (_scanning)
                const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              else
                IconButton(icon: const Icon(Icons.refresh), onPressed: _startScan),
            ],
          ),
          const SizedBox(height: 8),
          if (_discovered.isEmpty && !_scanning)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Nic nie znaleziono. Upewnij się, że telefon i TV są w tej samej sieci WiFi.'),
            ),
          for (final d in _discovered)
            Card(
              child: ListTile(
                title: Text(d.displayName),
                subtitle: Text('${d.brand.label} · ${d.ip}:${d.port}'),
                trailing: IconButton(
                  icon: const Icon(Icons.add_circle_outline),
                  onPressed: () => _addDiscovered(d),
                ),
              ),
            ),
          const SizedBox(height: 24),
          Text('Dodaj ręcznie po adresie IP', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Nazwa (opcjonalnie)'),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _ipController,
                  decoration: const InputDecoration(labelText: 'Adres IP telewizora'),
                  keyboardType: TextInputType.number,
                  validator: (v) {
                    final parts = v?.trim().split('.') ?? [];
                    if (parts.length != 4) return 'Podaj poprawny adres IP';
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<TvBrand>(
                  value: _manualBrand,
                  decoration: const InputDecoration(labelText: 'Typ telewizora'),
                  items: [
                    for (final b in TvBrand.values) DropdownMenuItem(value: b, child: Text(b.label)),
                  ],
                  onChanged: (v) => setState(() => _manualBrand = v ?? _manualBrand),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(onPressed: _submitManual, child: const Text('Dodaj')),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
