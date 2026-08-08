import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/animated_action_button.dart';
import 'package:trtripsathi_mobile/core/widgets/travel_background.dart';

class IntroOnboardingScreen extends StatefulWidget {
  const IntroOnboardingScreen({super.key});

  @override
  State<IntroOnboardingScreen> createState() => _IntroOnboardingScreenState();
}

class _IntroOnboardingScreenState extends State<IntroOnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  static const _slides = [
    _OnboardingSlide(
      title: 'Discover Nepal\nwithout limits',
      subtitle:
          'Curated routes, hidden places, and practical travel details in one companion.',
      icon: Icons.explore_rounded,
      secondaryIcon: Icons.landscape_rounded,
    ),
    _OnboardingSlide(
      title: 'Find your\ntravel people',
      subtitle:
          'Join verified campaigns, meet compatible explorers, and plan every detail together.',
      icon: Icons.groups_rounded,
      secondaryIcon: Icons.route_rounded,
    ),
    _OnboardingSlide(
      title: 'Turn every trip\ninto a story',
      subtitle:
          'Track achievements, share trusted reviews, and build a travel profile that grows with you.',
      icon: Icons.auto_awesome_rounded,
      secondaryIcon: Icons.photo_camera_rounded,
    ),
  ];

  Future<void> _complete() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('intro_done', true);
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(RouteNames.signup);
  }

  void _next() {
    if (_index == _slides.length - 1) {
      _complete();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 520),
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: TravelBackground(
          child: SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
                  child: Row(
                    children: [
                      const Icon(Icons.terrain_rounded, color: AppColors.navy),
                      const SizedBox(width: 8),
                      const Text(
                        'TripSathi',
                        style: TextStyle(
                          color: AppColors.navy,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: _complete,
                        child: const Text('Skip'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _slides.length,
                    onPageChanged: (value) => setState(() => _index = value),
                    itemBuilder: (context, itemIndex) => AnimatedBuilder(
                      animation: _controller,
                      builder: (context, child) {
                        final page = _controller.hasClients
                            ? (_controller.page ?? _index.toDouble())
                            : _index.toDouble();
                        final delta = (page - itemIndex).clamp(-1.0, 1.0);
                        return Opacity(
                          opacity: 1 - delta.abs() * .35,
                          child: Transform.translate(
                            offset: Offset(-delta * 42, 0),
                            child: child,
                          ),
                        );
                      },
                      child: _SlideView(
                          slide: _slides[itemIndex], index: itemIndex),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 22),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          _slides.length,
                          (dotIndex) => AnimatedContainer(
                            duration: const Duration(milliseconds: 280),
                            curve: Curves.easeOut,
                            width: dotIndex == _index ? 30 : 8,
                            height: 8,
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            decoration: BoxDecoration(
                              color: dotIndex == _index
                                  ? AppColors.goldDark
                                  : AppColors.line,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      AnimatedActionButton(
                        label: _index == _slides.length - 1
                            ? 'Get Started'
                            : 'Continue',
                        icon: _index == _slides.length - 1
                            ? Icons.rocket_launch_rounded
                            : Icons.arrow_forward_rounded,
                        onPressed: _next,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide, required this.index});
  final _OnboardingSlide slide;
  final int index;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
          child: ConstrainedBox(
            constraints: BoxConstraints(
                minHeight: math.max(0, constraints.maxHeight - 24)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _TravelIllustration(slide: slide, index: index),
                const SizedBox(height: 42),
                Text(
                  slide.title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        fontSize: constraints.maxWidth < 360 ? 32 : 38,
                        height: 1.08,
                      ),
                ),
                const SizedBox(height: 18),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 470),
                  child: Text(
                    slide.subtitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodyLarge
                        ?.copyWith(fontSize: 16),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class _TravelIllustration extends StatelessWidget {
  const _TravelIllustration({required this.slide, required this.index});
  final _OnboardingSlide slide;
  final int index;

  @override
  Widget build(BuildContext context) => Hero(
        tag: 'onboarding-illustration-$index',
        child: Container(
          width: 240,
          height: 240,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [
                AppColors.navy.withValues(alpha: .98),
                AppColors.navyLight,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.navy.withValues(alpha: .2),
                blurRadius: 40,
                offset: const Offset(0, 20),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 184,
                height: 184,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: Colors.white.withValues(alpha: .16), width: 2),
                ),
              ),
              Icon(slide.icon, color: Colors.white, size: 88),
              Positioned(
                right: 25,
                bottom: 36,
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Icon(slide.secondaryIcon,
                      color: AppColors.navy, size: 34),
                ),
              ),
            ],
          ),
        ),
      );
}

class _OnboardingSlide {
  const _OnboardingSlide({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.secondaryIcon,
  });
  final String title;
  final String subtitle;
  final IconData icon;
  final IconData secondaryIcon;
}
