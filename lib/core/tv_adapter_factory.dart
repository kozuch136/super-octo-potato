import '../adapters/adb/adb_tv_adapter.dart';
import '../adapters/lgwebos/lgwebos_tv_adapter.dart';
import '../adapters/samsung/samsung_tv_adapter.dart';
import '../models/tv_brand.dart';
import '../models/tv_device.dart';
import 'device_repository.dart';
import 'tv_adapter.dart';

/// Builds the right [TvAdapter] implementation for a [TvDevice], wiring in
/// the [DeviceRepository] callbacks each adapter needs to persist its own
/// pairing secret.
class TvAdapterFactory {
  TvAdapterFactory(this._repository);

  final DeviceRepository _repository;

  TvAdapter create(TvDevice device) {
    switch (device.brand) {
      case TvBrand.androidTv:
        return AdbTvAdapter(
          device: device,
          loadKeyPair: () => _repository.loadAdbKeyPair(device.id),
          saveKeyPair: (kp) => _repository.saveAdbKeyPair(device.id, kp),
        );
      case TvBrand.lg:
        return LgWebosTvAdapter(
          device: device,
          loadClientKey: () => _repository.loadLgClientKey(device.id),
          saveClientKey: (key) => _repository.saveLgClientKey(device.id, key),
        );
      case TvBrand.samsung:
        return SamsungTvAdapter(
          device: device,
          loadToken: () => _repository.loadSamsungToken(device.id),
          saveToken: (token) => _repository.saveSamsungToken(device.id, token),
        );
    }
  }
}
