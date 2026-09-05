import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A round icon button used throughout the remote screen. Presses trigger a
/// light haptic tick, matching how physical remote buttons feel.
class RemoteButton extends StatelessWidget {
  const RemoteButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.size = 56,
    this.label,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: size,
      height: size,
      child: FilledButton(
        onPressed: onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                onTap!();
              },
        child: Icon(icon, size: size * 0.42),
      ),
    );
    if (label == null) return button;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        button,
        const SizedBox(height: 4),
        Text(label!, style: Theme.of(context).textTheme.labelSmall),
      ],
    );
  }
}
