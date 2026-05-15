import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'providers/auth_provider.dart';
import 'providers/trips_provider.dart';
import 'providers/reviews_provider.dart';
import 'providers/campaigns_provider.dart';
import 'providers/achievements_provider.dart';
import 'screens/splash/splash_screen.dart';
import 'screens/onboarding/intro.dart';
import 'screens/onboarding/profile_setup.dart';
import 'screens/auth/login.dart';
import 'screens/profile/profile.dart';
import 'screens/dashboard/dashboard.dart';
import 'screens/auth/signup.dart';
import 'services/api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables (guarded: mobile builds may not include a .env file)
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    // ignore: avoid_print
    print('No .env file found or failed to load: $e');
  }

  // Read BACKEND_URL from .env (trim/normalize). Fall back to emulator default.
  var envUrl = dotenv.env['BACKEND_URL']?.trim() ?? '';
  if (envUrl.isNotEmpty) {
    if (!envUrl.startsWith('http')) envUrl = 'http://$envUrl';
    // If no explicit port provided, assume 3000 (common backend dev port)
    if (!RegExp(r':\d+$').hasMatch(envUrl)) envUrl = '$envUrl:3000';
    ApiService.baseUrl = envUrl;
  } else {
    ApiService.baseUrl = 'http://10.0.2.2:3000';
  }

  // Help debugging on-device: print chosen backend
  // ignore: avoid_print
  print('Backend URL: ${ApiService.baseUrl}');

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
  bool _introDone = false;
  bool _accountCreated = false;
  bool _profileSetupDone = false;
  bool _loading = true;
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    final prefs = await SharedPreferences.getInstance();

    setState(() {
      _introDone = prefs.getBool('intro_done') ?? false;
      _accountCreated = prefs.getBool('account_created') ?? false;
      _profileSetupDone = prefs.getBool('onboarding_done') ?? false;
      _loading = false;
    });
  }

  void _completeSplash() {
    setState(() {
      _showSplash = false;
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

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => TripsProvider()),
        ChangeNotifierProvider(create: (_) => ReviewsProvider()),
        ChangeNotifierProvider(create: (_) => CampaignsProvider()),
        ChangeNotifierProvider(create: (_) => AchievementsProvider()),
      ],
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
            home: _showSplash
                ? SplashScreen(onComplete: _completeSplash)
                : _getInitialScreen(auth),
            routes: {
              '/': (_) => const LoginScreen(),
              '/signup': (_) => const SignupScreen(),
              '/onboarding': (_) => const IntroOnboardingScreen(),
              '/profile-setup': (_) => const ProfileSetupScreen(),
              '/profile': (_) => const ProfileScreen(),
              '/dashboard': (_) => const DashboardScreen(),
            },
          );
        },
      ),
    );
  }

  Widget _getInitialScreen(AuthProvider auth) {
    if (!_introDone) {
      return const IntroOnboardingScreen();
    }
    if (!_accountCreated) {
      return const SignupScreen();
    }
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }
    if (!_profileSetupDone) {
      return const ProfileSetupScreen();
    }
    return const DashboardScreen();
  }
}
