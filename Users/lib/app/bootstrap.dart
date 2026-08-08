import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/app/tripsathi_app.dart';
import 'package:trtripsathi_mobile/core/config/app_environment.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/providers/auth_provider.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  _configureGlobalErrorHandling();

  try {
    await AppEnvironment.load();

    final authProvider = AuthProvider();
    runApp(TripSathiApp(authProvider: authProvider));
  } catch (error, stackTrace) {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stackTrace,
        library: 'application bootstrap',
      ),
    );
    runApp(_BootstrapFailureApp(error: error));
  }
}

class _BootstrapFailureApp extends StatelessWidget {
  const _BootstrapFailureApp({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFFF6F8FC),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    size: 54,
                    color: Color(0xFFB26A00),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'TripSathi could not start',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    kDebugMode
                        ? error.toString()
                        : 'Please update the app or contact support.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

void _configureGlobalErrorHandling() {
  ErrorWidget.builder = (details) => const Material(
        color: Colors.white,
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 42, color: Colors.redAccent),
                SizedBox(height: 12),
                Text(
                  'Something went wrong while rendering this screen.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );

  FlutterError.onError = FlutterError.presentError;
  PlatformDispatcher.instance.onError = (error, stack) {
    // ignore: avoid_print
    print('Unhandled platform error: $error');
    return true;
  };
}
