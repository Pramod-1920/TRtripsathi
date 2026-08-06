import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:ui';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
<<<<<<< HEAD
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
=======
import 'screens/login.dart';
import 'screens/onboarding.dart';
import 'screens/profile.dart';
import 'screens/signup.dart';
import 'screens/splash.dart';
import 'screens/welcome_onboarding.dart';
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
import 'services/api.dart';
import 'ui/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

<<<<<<< HEAD
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return Material(
      color: Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
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
  };
=======
  ApiService.configure();
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    // ignore: avoid_print
    print('Unhandled platform error: $error');
    return true;
  };

  // Load environment variables (guarded: mobile builds may not include a .env file)
  try {
    await dotenv.load(fileName: ".env");
  } catch (e) {
    // ignore: avoid_print
    print('No .env file found or failed to load: $e');
  }

  // Prefer BACKEND_URL passed via `--dart-define` (works reliably on real phones),
  // then fall back to `.env`, then emulator default.
  final dartEnvUrl = const String.fromEnvironment('BACKEND_URL', defaultValue: '').trim();
  var envUrl = dartEnvUrl.isNotEmpty ? dartEnvUrl : (dotenv.env['BACKEND_URL']?.trim() ?? '');

  if (envUrl.isNotEmpty) {
    if (!envUrl.startsWith('http')) envUrl = 'http://$envUrl';
    // If no explicit port provided, assume 3000 (common backend dev port)
    if (!RegExp(r':\d+$').hasMatch(envUrl)) envUrl = '$envUrl:3000';
    ApiService.baseUrl = envUrl;
  } else {
    // Android emulator special-case: host machine is reachable via 10.0.2.2.
    ApiService.baseUrl = 'http://10.0.2.2:3000';
  }

  // Help debugging on-device: print chosen backend
  // ignore: avoid_print
  print('Backend URL: ${ApiService.baseUrl}');

  final authProvider = AuthProvider();
  await authProvider.initialize();

  runApp(MyApp(authProvider: authProvider));
}

<<<<<<< HEAD
class MyApp extends StatefulWidget {
  final AuthProvider authProvider;
  const MyApp({super.key, required this.authProvider});
=======
class MyApp extends StatelessWidget {
  const MyApp({super.key});
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
<<<<<<< HEAD
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _introDone = false;
  bool _accountCreated = false;
  bool _profileSetupDone = false;
  bool _loading = true;
  bool _showSplash = true;
  String? _startupError;

  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(seconds: 8),
      );

      setState(() {
        _introDone = prefs.getBool('intro_done') ?? false;
        _accountCreated = prefs.getBool('account_created') ?? false;
        _profileSetupDone = prefs.getBool('onboarding_done') ?? false;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _startupError = 'Failed to initialize app storage. Please restart app.';
        _loading = false;
      });
      // ignore: avoid_print
      print('Onboarding init failed: $e');
    }
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

    if (_startupError != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: Colors.white,
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    size: 44,
                    color: Colors.orange,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _startupError!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _loading = true;
                        _startupError = null;
                      });
                      _checkOnboarding();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(create: (_) => widget.authProvider),
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
            themeMode: ThemeMode.light,
            theme: AppTheme.light(),
            builder: (context, child) => ColoredBox(
              color: Colors.white,
              child: child ?? const SizedBox.shrink(),
            ),
            home: _showSplash
                ? SplashScreen(onComplete: _completeSplash)
                : _getInitialScreen(auth),
            routes: {
              '/login': (_) => const LoginScreen(),
              '/signup': (_) => const SignupScreen(),
              '/onboarding': (_) => const IntroOnboardingScreen(),
              '/profile-setup': (_) => const ProfileSetupScreen(),
              '/profile': (_) => const ProfileScreen(),
              '/dashboard': (_) => const DashboardScreen(),
            },
          );
=======
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
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
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
