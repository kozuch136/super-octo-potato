import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'services/remote_manager.dart';
import 'theme/app_theme.dart';

class WifiTvRemoteApp extends StatelessWidget {
  const WifiTvRemoteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => RemoteManager(),
      child: MaterialApp(
        title: 'Pilot WiFi',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: const HomeScreen(),
      ),
    );
  }
}
