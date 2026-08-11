import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/pages/campaigns_page.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/chat/presentation/pages/chat_page.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/profile_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trips_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';
import 'package:provider/provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  static const _destinations = <_NavigationDestination>[
    _NavigationDestination(
      label: 'Home',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavigationDestination(
      label: 'Trips',
      icon: Icons.route_outlined,
      selectedIcon: Icons.route_rounded,
    ),
    _NavigationDestination(
      label: 'Campaigns',
      icon: Icons.campaign_outlined,
      selectedIcon: Icons.campaign_rounded,
    ),
    _NavigationDestination(
      label: 'Chat',
      icon: Icons.chat_bubble_outline_rounded,
      selectedIcon: Icons.chat_bubble_rounded,
    ),
    _NavigationDestination(
      label: 'Map',
      icon: Icons.map_outlined,
      selectedIcon: Icons.map_rounded,
    ),
  ];

  late final AnimationController _pageAnimation;
  late List<Widget?> _pages;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _resetPageSlots();
    _pageAnimation = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
      value: 1,
    );
    // Start trip data in the background while the user is on Home so the
    // Trips tab is usually ready by the time it is opened.
    context.read<TripsProvider>().loadTrips();
    context.read<CampaignsProvider>().loadCampaigns();
  }

  void _resetPageSlots() {
    _pages = <Widget?>[
      _HomeTab(onSelectPage: _selectPage),
      null,
      null,
      null,
      null,
    ];
  }

  void _ensurePageSlots() {
    if (_pages.length != _destinations.length) _resetPageSlots();
  }

  @override
  void dispose() {
    _pageAnimation.dispose();
    super.dispose();
  }

  void _selectPage(int index) {
    _ensurePageSlots();
    if (index < 0 || index >= _destinations.length) return;
    if (index == _selectedIndex) return;

    _pages[index] ??= switch (index) {
      1 => const TripsListScreen(),
      2 => const CampaignsListScreen(),
      3 => const ChatInboxScreen(),
      4 => const _MapPlaceholderScreen(),
      _ => _HomeTab(onSelectPage: _selectPage),
    };

    setState(() => _selectedIndex = index);
    _pageAnimation.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    _ensurePageSlots();
    final pageCurve = CurvedAnimation(
      parent: _pageAnimation,
      curve: Curves.easeOutCubic,
    );

    return Scaffold(
      body: FadeTransition(
        opacity: Tween<double>(begin: .88, end: 1).animate(pageCurve),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, .012),
            end: Offset.zero,
          ).animate(pageCurve),
          child: IndexedStack(
            index: _selectedIndex,
            children: _pages
                .map((page) => page ?? const SizedBox.shrink())
                .toList(growable: false),
          ),
        ),
      ),
      bottomNavigationBar: _HomeBottomNavigationBar(
        destinations: _destinations,
        selectedIndex: _selectedIndex,
        onSelected: _selectPage,
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab({required this.onSelectPage});

  final ValueChanged<int> onSelectPage;

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  Map<String, dynamic>? _profile = ApiService.cachedProfile;

  @override
  void initState() {
    super.initState();
    _prefetchProfile();
  }

  Future<void> _prefetchProfile() async {
    try {
      final profile = await ApiService.getProfile(
        forceRefresh: _profile != null,
      );
      if (mounted) setState(() => _profile = profile);
    } catch (_) {}
  }

  void _openProfile() {
    Navigator.of(context)
        .push<void>(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(initialProfile: _profile),
      ),
    )
        .then((_) {
      if (!mounted) return;
      final cached = ApiService.cachedProfile;
      if (cached != null) setState(() => _profile = cached);
    });
  }

  @override
  Widget build(BuildContext context) {
    final photoUrl = (_profile?['profilePhoto'] ?? '').toString().trim();
    final rankCode =
        (_profile?['experienceLevel'] ?? 'F').toString().trim().toUpperCase();
    final rankProgress = _rankProgressValue(_profile);
    final rankColor = _rankGaugeColor(rankCode);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 68,
        title: const Text('Trip Sathi'),
        actions: [
          Semantics(
            button: true,
            label: 'Open profile, rank $rankCode',
            child: InkWell(
              onTap: _openProfile,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(9, 5, 13, 5),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox.square(
                      dimension: 40,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          CircularProgressIndicator(
                            value: rankProgress,
                            strokeWidth: 3,
                            strokeCap: StrokeCap.round,
                            backgroundColor: AppColors.line,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(rankColor),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(4),
                            child: CircleAvatar(
                              backgroundColor:
                                  AppColors.gold.withValues(alpha: .2),
                              backgroundImage: photoUrl.isEmpty
                                  ? null
                                  : NetworkImage(photoUrl),
                              child: photoUrl.isEmpty
                                  ? const Icon(
                                      Icons.person_rounded,
                                      size: 20,
                                      color: AppColors.navy,
                                    )
                                  : null,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Rank $rankCode',
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontSize: 9,
                        height: 1,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
        children: [
          _HeroCard(
            title: 'Plan your next adventure',
            subtitle: 'Trips, campaigns, and community—right here.',
            onTap: () => widget.onSelectPage(1),
          ),
          const SizedBox(height: 16),
          Text(
            'Quick actions',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _QuickAction(
                  icon: Icons.person,
                  label: 'Profile',
                  onTap: _openProfile,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickAction(
                  icon: Icons.travel_explore,
                  label: 'Trips',
                  onTap: () => widget.onSelectPage(1),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _QuickAction(
                  icon: Icons.campaign,
                  label: 'Campaigns',
                  onTap: () => widget.onSelectPage(2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickAction(
                  icon: Icons.reviews,
                  label: 'Reviews',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Reviews coming soon')),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Explore',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: const Icon(Icons.auto_awesome),
              title: const Text('Recommended for you'),
              subtitle: const Text('We will personalize this soon'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Recommendations coming soon')),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: const Icon(Icons.shield),
              title: const Text('Safety & tips'),
              subtitle: const Text('Learn what to pack and how to prepare'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tips coming soon')),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapPlaceholderScreen extends StatelessWidget {
  const _MapPlaceholderScreen();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Map'),
              Text(
                'Explore trips by location',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: .2),
                    borderRadius: BorderRadius.circular(26),
                  ),
                  child: const Icon(
                    Icons.map_rounded,
                    color: AppColors.navy,
                    size: 42,
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Interactive map coming soon',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.navy,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'This tab will show nearby trips, campaign destinations, and places you have visited.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      );
}

class _HomeBottomNavigationBar extends StatelessWidget {
  const _HomeBottomNavigationBar({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<_NavigationDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 350;

        return DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            border: const Border(
              top: BorderSide(color: AppColors.line, width: .8),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.navy.withValues(alpha: .07),
                blurRadius: 24,
                offset: const Offset(0, -6),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            minimum: EdgeInsets.fromLTRB(
              compact ? 4 : 10,
              7,
              compact ? 4 : 10,
              6,
            ),
            child: SizedBox(
              height: compact ? 58 : 62,
              child: Row(
                children: List.generate(destinations.length, (index) {
                  final destination = destinations[index];
                  return Expanded(
                    child: _NavigationItem(
                      destination: destination,
                      selected: index == selectedIndex,
                      compact: compact,
                      onTap: () => onSelected(index),
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    required this.destination,
    required this.selected,
    required this.compact,
    required this.onTap,
  });

  final _NavigationDestination destination;
  final bool selected;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.navy : AppColors.muted;

    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      child: InkResponse(
        onTap: onTap,
        radius: 30,
        highlightShape: BoxShape.rectangle,
        containedInkWell: true,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 240),
                curve: Curves.easeOutCubic,
                width: selected ? (compact ? 42 : 46) : 34,
                height: 30,
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.gold.withValues(alpha: .2)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  transitionBuilder: (child, animation) => ScaleTransition(
                    scale: Tween<double>(begin: .78, end: 1).animate(animation),
                    child: FadeTransition(opacity: animation, child: child),
                  ),
                  child: Icon(
                    selected ? destination.selectedIcon : destination.icon,
                    key: ValueKey(selected),
                    color: color,
                    size: compact ? 22 : 23,
                  ),
                ),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                style: TextStyle(
                  color: color,
                  fontSize: compact ? 10 : 11,
                  height: 1,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  letterSpacing: selected ? -.1 : 0,
                ),
                child: Text(
                  destination.label,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavigationDestination {
  const _NavigationDestination({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _HeroCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            colors: [
              cs.primary.withValues(alpha: 0.12),
              cs.primary.withValues(alpha: 0.06),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: cs.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.terrain, color: Colors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(fontSize: 13.5),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          color: Colors.white,
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: cs.primary.withValues(alpha: 0.12),
              ),
              child: Icon(icon, color: cs.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontSize: 15),
              ),
            ),
            const Icon(Icons.chevron_right, size: 18),
          ],
        ),
      ),
    );
  }
}

double _rankProgressValue(Map<String, dynamic>? profile) {
  final progress = profile?['nextRankProgress'];
  if (progress is! Map) return 0;
  if (progress['nextRankHidden'] == true) return 1;

  final percentage = progress['progressPercentage'];
  if (percentage is! num) return 0;
  return (percentage / 100).clamp(0.0, 1.0).toDouble();
}

Color _rankGaugeColor(String rankCode) => switch (rankCode.toUpperCase()) {
      'F' => const Color(0xFF78909C),
      'E' => const Color(0xFF43A047),
      'D' => const Color(0xFF00897B),
      'C' => const Color(0xFF1E88E5),
      'B' => const Color(0xFF7E57C2),
      'A' => const Color(0xFFFFB300),
      'S' => const Color(0xFFEF5350),
      'SS' => const Color(0xFFEC407A),
      'SSS' => const Color(0xFF26C6DA),
      'MYTHIC' => const Color(0xFFAB47BC),
      'HEROIC' => const Color(0xFFFF6D00),
      _ => AppColors.gold,
    };
