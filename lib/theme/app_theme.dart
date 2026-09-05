import 'package:flutter/material.dart';

/// A single, deliberately calm dark theme - a remote app lives on screen
/// while the room is dark and the TV is the thing to look at, so the UI
/// itself stays low-contrast and free of anything resembling a banner slot.
class AppTheme {
  static const seed = Color(0xFF3D8BFD);

  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.dark,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFF0E1116),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      cardTheme: CardTheme(
        color: const Color(0xFF171B22),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: const CircleBorder(),
          backgroundColor: const Color(0xFF1E232C),
          foregroundColor: Colors.white,
        ),
      ),
    );
  }
}
