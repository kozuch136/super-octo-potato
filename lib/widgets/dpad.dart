import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/remote_action.dart';

/// The classic cross-shaped navigation pad with a center OK button.
class Dpad extends StatelessWidget {
  const Dpad({super.key, required this.onAction, this.diameter = 220});

  final void Function(RemoteAction action) onAction;
  final double diameter;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    void tap(RemoteAction action) {
      HapticFeedback.lightImpact();
      onAction(action);
    }

    Widget arrow(IconData icon, RemoteAction action, Alignment alignment) {
      return Align(
        alignment: alignment,
        child: SizedBox(
          width: diameter / 3,
          height: diameter / 3,
          child: IconButton(
            onPressed: () => tap(action),
            icon: Icon(icon),
            iconSize: diameter * 0.16,
          ),
        ),
      );
    }

    return SizedBox(
      width: diameter,
      height: diameter,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: scheme.surfaceContainerHigh,
        ),
        child: Stack(
          children: [
            arrow(Icons.keyboard_arrow_up, RemoteAction.up, Alignment.topCenter),
            arrow(Icons.keyboard_arrow_down, RemoteAction.down, Alignment.bottomCenter),
            arrow(Icons.keyboard_arrow_left, RemoteAction.left, Alignment.centerLeft),
            arrow(Icons.keyboard_arrow_right, RemoteAction.right, Alignment.centerRight),
            Center(
              child: SizedBox(
                width: diameter * 0.4,
                height: diameter * 0.4,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    shape: const CircleBorder(),
                    backgroundColor: scheme.primary,
                  ),
                  onPressed: () => tap(RemoteAction.select),
                  child: const Text('OK'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
