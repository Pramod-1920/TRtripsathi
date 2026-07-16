import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login.dart';
import 'screens/onboarding.dart';
import 'screens/profile.dart';
import 'screens/signup.dart';
import 'screens/splash.dart';
import 'screens/welcome_onboarding.dart';
import 'services/api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  ApiService.configure();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        navigatorKey: MyApp.navigatorKey,
        title: 'TripSathi',
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0D9488),
            primary: const Color(0xFF0D9488),
            secondary: const Color(0xFFF59E0B),
            surface: const Color(0xFFF7FAF9),
          ),
          scaffoldBackgroundColor: const Color(0xFFF7FAF9),
          fontFamily: 'sans-serif',
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: Color(0xFFE1EAE7))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide:
                    const BorderSide(color: Color(0xFF0D9488), width: 1.6)),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              backgroundColor: const Color(0xFF0D9488),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18)),
              textStyle:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        initialRoute: '/splash',
        routes: {
          '/splash': (_) => const SplashScreen(),
          '/welcome': (_) => const WelcomeOnboardingScreen(),
          '/login': (_) => const LoginScreen(),
          '/signup': (_) => const SignupScreen(),
          '/profile-setup': (_) => const OnboardingScreen(),
          '/profile': (_) => const ProfileScreen(),
        },
      ),
    );
  }
}
