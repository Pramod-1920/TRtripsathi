import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart' as dotenv;

import 'screens/login.dart';
import 'screens/signup.dart';
import 'screens/onboarding.dart';
import 'screens/profile.dart';
import 'services/api.dart';
import 'providers/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Load environment variables from .env (if present). This lets you set BACKEND_URL there.
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {}

  final envUrl = dotenv.env['BACKEND_URL'];
  final backendUrl = envUrl?.isNotEmpty == true
      ? envUrl!
      : const String.fromEnvironment('BACKEND_URL', defaultValue: 'http://10.0.2.2:3000');

  ApiService.baseUrl = backendUrl;
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          // React to auth changes and navigate accordingly after build completes
          WidgetsBinding.instance.addPostFrameCallback((_) {
            final nav = navigatorKey.currentState;
            if (nav == null) return;
            try {
              if (!auth.isAuthenticated) {
                nav.pushNamedAndRemoveUntil('/', (route) => false);
                return;
              }

              // If authenticated, ensure we're on profile (but avoid duplicate pushes)
              nav.pushNamedAndRemoveUntil('/profile', (route) => false);
            } catch (_) {}
          });

          return MaterialApp(
            navigatorKey: navigatorKey,
            title: 'TRtripsathi',
            theme: ThemeData(
              primarySwatch: Colors.blue,
            ),
            // initialRoute kept to '/', navigation will be handled by provider listener
            initialRoute: '/',
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
