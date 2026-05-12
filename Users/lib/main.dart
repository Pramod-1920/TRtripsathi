import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'screens/login.dart';
import 'screens/signup.dart';
import 'screens/onboarding.dart';
import 'screens/profile.dart';
import 'services/api.dart';
import 'providers/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Load environment variables from .env (if present)
  String backendUrl = 'http://10.0.2.2:3000';
  try {
    await dotenv.load(fileName: '.env');
    final envUrl = dotenv.env['BACKEND_URL'];
    if (envUrl?.isNotEmpty == true) {
      backendUrl = envUrl!;
    }
  } catch (_) {
    // Use default if .env is not found or can't be loaded
    backendUrl = const String.fromEnvironment('BACKEND_URL',
        defaultValue: 'http://10.0.2.2:3000');
  }

  ApiService.baseUrl = backendUrl;
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return MaterialApp(
            navigatorKey: navigatorKey,
            title: 'TRtripsathi',
            theme: ThemeData(
              primarySwatch: Colors.blue,
            ),
            initialRoute: auth.isAuthenticated ? '/profile' : '/',
            routes: {
              '/': (context) => const LoginScreen(),
              '/signup': (context) => const SignupScreen(),
              '/onboarding': (context) => const OnboardingScreen(),
              '/profile': (context) => const ProfileScreen(),
            },
          );
        },
      ),
    );
  }
}
