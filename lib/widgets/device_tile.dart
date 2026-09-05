import 'package:flutter/material.dart';

import '../models/tv_brand.dart';
import '../models/tv_device.dart';

class DeviceTile extends StatelessWidget {
  const DeviceTile({
    super.key,
    required this.device,
    required this.onTap,
    this.onDelete,
  });

  final TvDevice device;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  IconData get _brandIcon => switch (device.brand) {
        TvBrand.androidTv => Icons.android,
        TvBrand.samsung => Icons.tv,
        TvBrand.lg => Icons.live_tv,
      };

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(child: Icon(_brandIcon)),
        title: Text(device.name),
        subtitle: Text('${device.brand.label} · ${device.ip}'),
        trailing: onDelete == null
            ? const Icon(Icons.chevron_right)
            : IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: onDelete,
              ),
        onTap: onTap,
      ),
    );
  }
}
