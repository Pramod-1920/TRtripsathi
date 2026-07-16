import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WelcomeOnboardingScreen extends StatefulWidget {
  const WelcomeOnboardingScreen({super.key});

  @override
  State<WelcomeOnboardingScreen> createState() =>
      _WelcomeOnboardingScreenState();
}

class _WelcomeOnboardingScreenState extends State<WelcomeOnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  static const _pages = [
    (
      icon: Icons.map_rounded,
      title: 'Discover Nepal differently',
      body:
          'Find remarkable places, hidden trails and local stories curated for curious explorers.',
      color: Color(0xFF0D9488)
    ),
    (
      icon: Icons.local_fire_department_rounded,
      title: 'Build your travel streak',
      body:
          'Check in, complete daily quests and turn every adventure into XP, levels and badges.',
      color: Color(0xFFF59E0B)
    ),
    (
      icon: Icons.groups_rounded,
      title: 'Journey with your Sathi',
      body:
          'Share progress, celebrate achievements and keep the motivation to explore day after day.',
      color: Color(0xFF6366F1)
    ),
  ];

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('intro_seen', true);
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(children: [
            Align(
                alignment: Alignment.centerRight,
                child:
                    TextButton(onPressed: _finish, child: const Text('Skip'))),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (value) => setState(() => _page = value),
                itemCount: _pages.length,
                itemBuilder: (_, index) {
                  final item = _pages[index];
                  return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 210,
                          height: 210,
                          decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: item.color.withValues(alpha: .1)),
                          child: Center(
                              child: Container(
                                  width: 126,
                                  height: 126,
                                  decoration: BoxDecoration(
                                      color: item.color,
                                      borderRadius: BorderRadius.circular(40),
                                      boxShadow: [
                                        BoxShadow(
                                            color: item.color
                                                .withValues(alpha: .3),
                                            blurRadius: 30,
                                            offset: const Offset(0, 16))
                                      ]),
                                  child: Icon(item.icon,
                                      color: Colors.white, size: 66))),
                        ),
                        const SizedBox(height: 52),
                        Text(item.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 30,
                                height: 1.12,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF12312E))),
                        const SizedBox(height: 18),
                        Text(item.body,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 16,
                                height: 1.55,
                                color: Color(0xFF647773))),
                      ]);
                },
              ),
            ),
            Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                    _pages.length,
                    (index) => AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: index == _page ? 26 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                            color: index == _page
                                ? const Color(0xFF0D9488)
                                : const Color(0xFFD5E2DF),
                            borderRadius: BorderRadius.circular(8))))),
            const SizedBox(height: 30),
            ElevatedButton(
              onPressed: () => _page == _pages.length - 1
                  ? _finish()
                  : _controller.nextPage(
                      duration: const Duration(milliseconds: 350),
                      curve: Curves.easeOutCubic),
              child: Text(
                  _page == _pages.length - 1 ? 'Start exploring' : 'Continue'),
            ),
            const SizedBox(height: 10),
            TextButton(
                onPressed: () async {
                  await SharedPreferences.getInstance()
                      .then((p) => p.setBool('intro_seen', true));
                  if (context.mounted)
                    Navigator.of(context).pushReplacementNamed('/signup');
                },
                child: const Text('New here? Create an account')),
          ]),
        ),
      ),
    );
  }
}
