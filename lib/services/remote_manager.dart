import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/device_repository.dart';
import '../core/tv_adapter.dart';
import '../core/tv_adapter_factory.dart';
import '../models/remote_action.dart';
import '../models/tv_device.dart';

/// App-wide state: the saved device list, and the currently active
/// connection (if the user is on the remote-control screen). Exposed via
/// `provider` so screens rebuild on connection-state changes without each
/// one re-implementing socket plumbing.
class RemoteManager extends ChangeNotifier {
  RemoteManager({DeviceRepository? repository})
      : _repository = repository ?? DeviceRepository() {
    _factory = TvAdapterFactory(_repository);
  }

  final DeviceRepository _repository;
  late final TvAdapterFactory _factory;

  List<TvDevice> devices = [];
  TvAdapter? activeAdapter;

  Future<void> loadDevices() async {
    devices = await _repository.loadDevices();
    notifyListeners();
  }

  Future<TvDevice> addDevice(TvDevice device) async {
    await _repository.upsertDevice(device);
    await loadDevices();
    return device;
  }

  Future<void> removeDevice(String id) async {
    if (activeAdapter?.device.id == id) {
      await disconnectActive();
    }
    await _repository.removeDevice(id);
    await loadDevices();
  }

  /// Opens a connection to [device] and makes it the active adapter. The
  /// returned adapter's `stateStream` should be watched by the UI for
  /// pairing/connection progress.
  Future<TvAdapter> connect(TvDevice device) async {
    await disconnectActive();
    final adapter = _factory.create(device);
    activeAdapter = adapter;
    notifyListeners();
    adapter.stateStream.listen((state) async {
      if (state == TvConnectionState.connected && !device.paired) {
        await _repository.upsertDevice(device.copyWith(paired: true));
        await loadDevices();
      }
      notifyListeners();
    });
    unawaited(adapter.connect().catchError((Object e) {
      debugPrint('TV connect failed: $e');
    }));
    return adapter;
  }

  Future<void> disconnectActive() async {
    final adapter = activeAdapter;
    activeAdapter = null;
    if (adapter != null) {
      await adapter.disconnect();
    }
  }

  Future<void> send(RemoteAction action) async {
    final adapter = activeAdapter;
    if (adapter == null) return;
    try {
      await adapter.sendAction(action);
    } catch (_) {
      // Best-effort: a single dropped keypress isn't worth surfacing as an
      // error dialog on every button tap; connection-level failures are
      // already visible via stateStream.
    }
  }
}
