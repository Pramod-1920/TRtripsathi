import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class IntroOnboardingScreen extends StatefulWidget {
  const IntroOnboardingScreen({super.key});

  @override
  State<IntroOnboardingScreen> createState() => _IntroOnboardingScreenState();
}

class _IntroOnboardingScreenState extends State<IntroOnboardingScreen>
    with TickerProviderStateMixin {
  late PageController _pageController;
  int _currentPage = 0;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  final List<OnboardingPage> pages = [
    OnboardingPage(
      title: 'Welcome to Yatri',
      subtitle: 'Find Your Trekking Companion',
      description:
          'Discover amazing hiking and trekking adventures with a community of adventure enthusiasts.',
      icon: Icons.terrain,
      color: const Color(0xFF6B5D47),
    ),
    OnboardingPage(
      title: 'Explore & Connect',
      subtitle: 'Join Adventures',
      description:
          'Browse nearby trips, join group expeditions, and make friends with fellow trekkers in your region.',
      icon: Icons.people,
      color: const Color(0xFF8B6F47),
    ),
    OnboardingPage(
      title: 'Earn XP & Rank',
      subtitle: 'Level Up Your Skills',
      description:
          'Complete trips, earn experience points, unlock badges, and climb the leaderboard. Show your expertise!',
      icon: Icons.stars,
      color: const Color(0xFFA0794C),
    ),
    OnboardingPage(
      title: 'Share & Review',
      subtitle: 'Build the Community',
      description:
          'Share your experiences, write reviews, upload photos, and help others discover amazing places.',
      icon: Icons.camera_alt,
      color: const Color(0xFFC85A1C),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeIn),
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  void _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('intro_done', true);
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/signup');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentPage = index;
              });
              _fadeController.forward(from: 0.0);
            },
            itemCount: pages.length,
            itemBuilder: (context, index) {
              return OnboardingPageView(page: pages[index]);
            },
          ),
          // Top right skip button
          Positioned(
            top: 16,
            right: 16,
            child: SafeArea(
              child: TextButton(
                onPressed: _completeOnboarding,
                child: Text(
                  'Skip',
                  style: TextStyle(
                    color: pages[_currentPage].color,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          // Bottom navigation
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 20,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(24),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Page indicators
                    FadeTransition(
                      opacity: _fadeAnimation,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          pages.length,
                          (index) => AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: _currentPage == index ? 28 : 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: _currentPage == index
                                  ? pages[_currentPage].color
                                  : const Color(0xFFE0E0E0),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Navigation buttons
                    Row(
                      children: [
                        if (_currentPage > 0)
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                _pageController.previousPage(
                                  duration: const Duration(milliseconds: 500),
                                  curve: Curves.easeInOut,
                                );
                              },
                              icon: const Icon(Icons.arrow_back),
                              label: const Text('Back'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: pages[_currentPage].color,
                                side: BorderSide(
                                  color: pages[_currentPage].color,
                                  width: 2,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        if (_currentPage > 0) const SizedBox(width: 16),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            onPressed: _nextPage,
                            icon: Icon(
                              _currentPage == pages.length - 1
                                  ? Icons.check
                                  : Icons.arrow_forward,
                            ),
                            label: Text(
                              _currentPage == pages.length - 1
                                  ? 'Get Started'
                                  : 'Next',
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: pages[_currentPage].color,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                vertical: 12,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingPageView extends StatefulWidget {
  final OnboardingPage page;

  const OnboardingPageView({required this.page, super.key});

  @override
  State<OnboardingPageView> createState() => _OnboardingPageViewState();
}

class _OnboardingPageViewState extends State<OnboardingPageView>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _slideAnimation;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );

    _slideAnimation = Tween<double>(begin: 50, end: 0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            widget.page.color.withOpacity(0.05),
            Colors.white,
          ],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Animated icon
                ScaleTransition(
                  scale: _scaleAnimation,
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.page.color.withOpacity(0.1),
                      border: Border.all(
                        color: widget.page.color.withOpacity(0.2),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      widget.page.icon,
                      size: 70,
                      color: widget.page.color,
                    ),
                  ),
                ),
                const SizedBox(height: 48),
                // Animated title
                SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.3),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(parent: _controller, curve: Curves.easeOut),
                  ),
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Column(
                      children: [
                        Text(
                          widget.page.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .displaySmall
                              ?.copyWith(
                                color: widget.page.color,
                                fontWeight: FontWeight.bold,
                                fontSize: 36,
                              ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          widget.page.subtitle,
                          textAlign: TextAlign.center,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: widget.page.color.withOpacity(0.7),
                                    fontWeight: FontWeight.w600,
                                    fontSize: 18,
                                  ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                // Description
                SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.2),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(parent: _controller, curve: Curves.easeOut),
                  ),
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Text(
                      widget.page.description,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.black.withOpacity(0.6),
                            height: 1.6,
                            fontSize: 16,
                          ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class OnboardingPage {
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;
  final Color color;

  OnboardingPage({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
    required this.color,
  });
}
