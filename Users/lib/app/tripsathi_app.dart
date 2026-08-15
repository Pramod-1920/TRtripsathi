import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/app/app_router.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/notifications/push_notification_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/achievements/presentation/providers/achievements_provider.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/providers/auth_provider.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/dashboard/presentation/pages/dashboard_page.dart';
import 'package:trtripsathi_mobile/features/onboarding/presentation/pages/intro_page.dart';
import 'package:trtripsathi_mobile/features/onboarding/presentation/pages/profile_setup_page.dart';
import 'package:trtripsathi_mobile/features/reviews/presentation/providers/reviews_provider.dart';
import 'package:trtripsathi_mobile/features/splash/presentation/pages/splash_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

class TripSathiApp extends StatefulWidget {
  const TripSathiApp({required this.authProvider, super.key});

  final AuthProvider authProvider;

  static final navigatorKey = GlobalKey<NavigatorState>();

  @override
  State<TripSathiApp> createState() => _TripSathiAppState();
}

class _TripSathiAppState extends State<TripSathiApp> {
  bool _introDone = false;
  bool _travelerProfileDone = false;
  bool _accountCreatedHere = false;
  bool _loading = true;
  bool _showSplash = true;
  bool _splashFinished = false;
  String? _startupError;

  @override
  void initState() {
    super.initState();
    widget.authProvider.addListener(_handleAuthStateChanged);
    PushNotificationService.instance.setReportOpenHandler(_openReports);
    _checkOnboarding();
  }

  @override
  void dispose() {
    widget.authProvider.removeListener(_handleAuthStateChanged);
    PushNotificationService.instance.clearReportOpenHandler();
    super.dispose();
  }

  Future<void> _checkOnboarding() async {
    try {
      final preferencesFuture = SharedPreferences.getInstance().timeout(
        const Duration(seconds: 8),
      );
      await Future.wait([
        preferencesFuture,
        widget.authProvider.initialize(),
      ]);
      final prefs = await preferencesFuture;

      if (widget.authProvider.isAuthenticated) {
        unawaited(
          PushNotificationService.instance.registerForCurrentUser(),
        );
      }

      if (!mounted) return;
      setState(() {
        _introDone = prefs.getBool('intro_done') ?? false;
        _travelerProfileDone = prefs.getBool('onboarding_done') ?? false;
        _accountCreatedHere = prefs.getBool('account_created') ?? false;
        _loading = false;
        if (_splashFinished) _showSplash = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _startupError = 'Failed to initialize app storage. Please restart app.';
        _loading = false;
      });
      // ignore: avoid_print
      print('Onboarding init failed: $error');
    }
  }

  void _completeSplash() {
    _splashFinished = true;
    if (!_loading) setState(() => _showSplash = false);
  }

  void _handleAuthStateChanged() {
    if (widget.authProvider.isAuthenticated) {
      unawaited(PushNotificationService.instance.registerForCurrentUser());
      return;
    }
    if (_showSplash) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final navigator = TripSathiApp.navigatorKey.currentState;
      if (navigator == null) return;
      navigator.pushNamedAndRemoveUntil(RouteNames.login, (_) => false);
    });
  }

  void _openReports() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final navigator = TripSathiApp.navigatorKey.currentState;
      if (navigator == null) return;
      navigator.pushNamed(RouteNames.reportIssue);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_startupError case final error?) {
      return _StartupErrorApp(error: error, onRetry: _retryStartup);
    }

    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: widget.authProvider),
        ChangeNotifierProvider(create: (_) => TripsProvider()),
        ChangeNotifierProvider(create: (_) => ReviewsProvider()),
        ChangeNotifierProvider(create: (_) => CampaignsProvider()),
        ChangeNotifierProvider(create: (_) => AchievementsProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) => MaterialApp(
          debugShowCheckedModeBanner: false,
          navigatorKey: TripSathiApp.navigatorKey,
          title: 'Yatri',
          themeMode: ThemeMode.light,
          theme: AppTheme.light(),
          builder: (context, child) => ColoredBox(
            color: Colors.white,
            child: child ?? const SizedBox.shrink(),
          ),
          home: _showSplash
              ? SplashScreen(onComplete: _completeSplash)
              : _initialScreen(auth),
          onGenerateRoute: AppRouter.onGenerateRoute,
        ),
      ),
    );
  }

  void _retryStartup() {
    setState(() {
      _loading = true;
      _startupError = null;
    });
    _checkOnboarding();
  }

  Widget _initialScreen(AuthProvider auth) {
    if (auth.isAuthenticated) {
      if (_accountCreatedHere && !_travelerProfileDone) {
        return const ProfileSetupScreen();
      }
      return const DashboardScreen();
    }
    if (!_introDone) return const IntroOnboardingScreen();
    return const LoginScreen();
  }
}

class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => MaterialApp(
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
                    error,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                      onPressed: onRetry, child: const Text('Retry')),
                ],
              ),
            ),
          ),
        ),
      );
}
