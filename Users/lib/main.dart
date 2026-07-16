import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'providers/auth_provider.dart';
import 'screens/login.dart';
import 'screens/onboarding.dart';
import 'screens/profile.dart';
import 'screens/signup.dart';
import 'services/api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Temporary backend URL
  ApiService.baseUrl = "http://10.0.2.2:3000";

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _showOnboarding = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    final prefs = await SharedPreferences.getInstance();

    final done = prefs.getBool('onboarding_done') ?? false;

    setState(() {
      _showOnboarding = !done;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }

    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            navigatorKey: MyApp.navigatorKey,
            title: 'Yatri',
            theme: ThemeData(
              primarySwatch: Colors.blue,
              useMaterial3: true,
            ),
            initialRoute: _showOnboarding
                ? '/onboarding'
                : (auth.isAuthenticated ? '/profile' : '/'),
            routes: {
              '/': (_) => const LoginScreen(),
              '/signup': (_) => const SignupScreen(),
              '/onboarding': (_) => const OnboardingScreen(),
              '/profile': (_) => const ProfileScreen(),
            },
          );
        },
      ),
    );
  }
}
