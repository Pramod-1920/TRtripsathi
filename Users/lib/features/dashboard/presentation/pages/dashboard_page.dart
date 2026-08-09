import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/providers/auth_provider.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/pages/campaigns_page.dart';
import 'package:trtripsathi_mobile/features/chat/presentation/pages/chat_page.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/profile_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trips_page.dart';

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
      label: 'Profile',
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
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
      4 => const ProfileScreen(),
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

class _HomeTab extends StatelessWidget {
  const _HomeTab({required this.onSelectPage});

  final ValueChanged<int> onSelectPage;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trip Sathi'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final navigator = Navigator.of(context);
              await auth.signOut();
              if (!context.mounted) return;
              navigator.pushReplacementNamed(RouteNames.login);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
        children: [
          _HeroCard(
            title: 'Plan your next adventure',
            subtitle: 'Trips, campaigns, and community—right here.',
            onTap: () => onSelectPage(1),
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
                  onTap: () => onSelectPage(4),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickAction(
                  icon: Icons.travel_explore,
                  label: 'Trips',
                  onTap: () => onSelectPage(1),
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
                  onTap: () => onSelectPage(2),
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
