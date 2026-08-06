import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'login.dart';
import 'welcome_onboarding.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;
  Timer? _navigationTimer;
  bool _introSeen = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200));
    _scale = CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
    _fade = CurvedAnimation(
        parent: _controller,
        curve: const Interval(.15, 1, curve: Curves.easeOut));
    _controller.forward();
    _loadPreference();
    _navigationTimer = Timer(const Duration(milliseconds: 2300), _navigate);
  }

  Future<void> _loadPreference() async {
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(milliseconds: 800),
      );
      _introSeen = prefs.getBool('intro_seen') ?? false;
    } catch (_) {
      // Storage should never prevent the user from entering the app.
    }
  }

  void _navigate() {
    if (!mounted || _navigated) return;
    _navigated = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) =>
            _introSeen ? const LoginScreen() : const WelcomeOnboardingScreen(),
      ),
    );
  }

  @override
  void dispose() {
    _navigationTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF064E4A),
                Color(0xFF0D9488),
                Color(0xFF2DD4BF)
              ]),
        ),
        child: Center(
          child: FadeTransition(
            opacity: _fade,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              ScaleTransition(
                scale: _scale,
                child: Container(
                  width: 104,
                  height: 104,
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: const [
                        BoxShadow(
                            color: Colors.black26,
                            blurRadius: 28,
                            offset: Offset(0, 14))
                      ]),
                  child: const Icon(Icons.explore_rounded,
                      size: 62, color: Color(0xFF0D9488)),
                ),
              ),
              const SizedBox(height: 28),
              const Text('TripSathi',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -.8)),
              const SizedBox(height: 8),
              Text('Every journey deserves a companion',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: .82),
                      fontSize: 15)),
            ]),
          ),
        ),
      ),
    );
  }
}
