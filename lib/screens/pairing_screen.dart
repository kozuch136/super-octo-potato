import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/tv_adapter.dart';
import '../models/tv_device.dart';
import '../services/remote_manager.dart';
import 'remote_screen.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, required this.device});
  final TvDevice device;

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  StreamSubscription<TvConnectionState>? _sub;
  TvConnectionState _state = TvConnectionState.connecting;
  String? _error;

  @override
  void initState() {
    super.initState();
    final adapter = context.read<RemoteManager>().activeAdapter;
    if (adapter == null) return;
    _state = adapter.state;
    _sub = adapter.stateStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _state = state;
        if (state != TvConnectionState.error) _error = null;
      });
      if (state == TvConnectionState.connected) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => RemoteScreen(device: widget.device)),
        );
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _retry() {
    setState(() => _error = null);
    context.read<RemoteManager>().connect(widget.device);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.device.name)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_state == TvConnectionState.error) ...[
                const Icon(Icons.error_outline, size: 56, color: Colors.redAccent),
                const SizedBox(height: 16),
                Text(_error ?? 'Nie udało się połączyć z telewizorem.', textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(onPressed: _retry, child: const Text('Spróbuj ponownie')),
              ] else ...[
                const CircularProgressIndicator(),
                const SizedBox(height: 24),
                Text(_message(), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _message() {
    switch (_state) {
      case TvConnectionState.awaitingPairing:
        return 'Zaakceptuj monit "Zezwól na połączenie" na ekranie telewizora, używając jego oryginalnego pilota.';
      case TvConnectionState.connecting:
        return 'Łączenie z ${widget.device.name}...';
      default:
        return 'Trwa łączenie...';
    }
  }
}
