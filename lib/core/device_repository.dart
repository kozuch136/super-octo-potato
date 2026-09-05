import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/tv_device.dart';

/// Persists the paired-device list (non-secret metadata, in
/// `shared_preferences`) and per-device secrets - the ADB RSA key pair, the
/// LG webOS client-key, the Samsung pairing token - in
/// `flutter_secure_storage` (Android Keystore / iOS Keychain backed), since
/// those are what let the app skip the on-TV "Allow?" prompt on every
/// reconnect.
class DeviceRepository {
  DeviceRepository({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _devicesKey = 'wifi_tv_remote.devices';

  final FlutterSecureStorage _secureStorage;

  Future<List<TvDevice>> loadDevices() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_devicesKey);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => TvDevice.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> _saveDevices(List<TvDevice> devices) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = jsonEncode(devices.map((d) => d.toJson()).toList());
    await prefs.setString(_devicesKey, raw);
  }

  Future<void> upsertDevice(TvDevice device) async {
    final devices = await loadDevices();
    final index = devices.indexWhere((d) => d.id == device.id);
    if (index >= 0) {
      devices[index] = device;
    } else {
      devices.add(device);
    }
    await _saveDevices(devices);
  }

  Future<void> removeDevice(String id) async {
    final devices = await loadDevices();
    devices.removeWhere((d) => d.id == id);
    await _saveDevices(devices);
    await Future.wait([
      _secureStorage.delete(key: _adbKey(id)),
      _secureStorage.delete(key: _lgKey(id)),
      _secureStorage.delete(key: _samsungKey(id)),
    ]);
  }

  String _adbKey(String id) => 'adb_keypair_$id';
  String _lgKey(String id) => 'lg_client_key_$id';
  String _samsungKey(String id) => 'samsung_token_$id';

  Future<Map<String, String>?> loadAdbKeyPair(String deviceId) async {
    final raw = await _secureStorage.read(key: _adbKey(deviceId));
    if (raw == null) return null;
    return (jsonDecode(raw) as Map<String, dynamic>).cast<String, String>();
  }

  Future<void> saveAdbKeyPair(String deviceId, Map<String, String> keyPair) {
    return _secureStorage.write(key: _adbKey(deviceId), value: jsonEncode(keyPair));
  }

  Future<String?> loadLgClientKey(String deviceId) {
    return _secureStorage.read(key: _lgKey(deviceId));
  }

  Future<void> saveLgClientKey(String deviceId, String key) {
    return _secureStorage.write(key: _lgKey(deviceId), value: key);
  }

  Future<String?> loadSamsungToken(String deviceId) {
    return _secureStorage.read(key: _samsungKey(deviceId));
  }

  Future<void> saveSamsungToken(String deviceId, String token) {
    return _secureStorage.write(key: _samsungKey(deviceId), value: token);
  }
}
