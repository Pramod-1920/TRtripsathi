import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/core/widgets/rank_badge_icon.dart';
import 'package:trtripsathi_mobile/core/localization/app_localizations.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/pages/campaigns_page.dart';
import 'package:trtripsathi_mobile/features/campaigns/domain/campaign_lifecycle.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/chat/presentation/pages/chat_page.dart';
import 'package:trtripsathi_mobile/features/map/presentation/pages/trip_map_page.dart';
import 'package:trtripsathi_mobile/features/profile/presentation/pages/profile_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trips_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/create_trip_wizard.dart';
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
  bool _exitDialogOpen = false;

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
      _HomeTab(onSelectPage: _selectPage, onOpenTrips: _openTrips),
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
      4 => const TripMapScreen(),
      _ => _HomeTab(onSelectPage: _selectPage, onOpenTrips: _openTrips),
    };

    setState(() => _selectedIndex = index);
    _pageAnimation.forward(from: 0);
  }

  void _openTrips(int filter) {
    _ensurePageSlots();
    _pages[1] = TripsListScreen(initialFilter: filter);
    setState(() => _selectedIndex = 1);
    _pageAnimation.forward(from: 0);
  }

  Future<void> _handleBackNavigation() async {
    if (_selectedIndex != 0) {
      _selectPage(0);
      return;
    }
    if (_exitDialogOpen) return;

    _exitDialogOpen = true;
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Exit TripSathi?'),
        content: const Text('Are you sure you want to exit the app?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Stay'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Exit'),
          ),
        ],
      ),
    );
    _exitDialogOpen = false;

    if (shouldExit == true && mounted) {
      await SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    _ensurePageSlots();
    final strings = AppLocalizations.of(context);
    final labels = [
      strings.home,
      strings.trips,
      strings.campaigns,
      strings.chat,
      strings.map,
    ];
    final localizedDestinations = List.generate(
      _destinations.length,
      (index) => _destinations[index].withLabel(labels[index]),
    );
    final pageCurve = CurvedAnimation(
      parent: _pageAnimation,
      curve: Curves.easeOutCubic,
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBackNavigation();
      },
      child: Scaffold(
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
          destinations: localizedDestinations,
          selectedIndex: _selectedIndex,
          onSelected: _selectPage,
        ),
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab({required this.onSelectPage, required this.onOpenTrips});

  final ValueChanged<int> onSelectPage;
  final ValueChanged<int> onOpenTrips;

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

  Future<void> _refresh() async {
    final results = await Future.wait([
      ApiService.getProfile(forceRefresh: true),
      context.read<CampaignsProvider>().loadCampaigns(),
      context.read<TripsProvider>().loadTrips(),
    ]);
    if (!mounted) return;
    setState(() => _profile = Map<String, dynamic>.from(results.first as Map));
  }

  Future<void> _createTrip() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => const CreateTripWizard()),
    );
    if (created == null || !mounted) return;
    await context.read<CampaignsProvider>().loadCampaigns();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Your new trip is ready.')),
    );
  }

  void _openPrivateCampaignFinder() {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => const CampaignsListScreen(openPrivateFinder: true),
      ),
    );
  }

  _HomeActionData? _nextAction(List<Map<String, dynamic>> campaigns) {
    Map<String, dynamic>? find(bool Function(Map<String, dynamic>) test) {
      for (final campaign in campaigns) {
        if (test(campaign)) return campaign;
      }
      return null;
    }

    final photoVerification =
        find((item) => item['awaitingVerification'] == true);
    if (photoVerification != null) {
      return _HomeActionData(
        eyebrow: 'TIME SENSITIVE',
        title: 'Verify your completed trip',
        description:
            'Upload your trip photo or video before the verification window closes.',
        buttonLabel: 'Open finished trips',
        icon: Icons.add_a_photo_rounded,
        color: const Color(0xFF8B5E00),
        onTap: () => widget.onOpenTrips(2),
      );
    }

    final decision = find(
      (item) => item['minimumParticipantDecisionRequired'] == true,
    );
    if (decision != null) {
      return _HomeActionData(
        eyebrow: 'HOST DECISION REQUIRED',
        title: (decision['title'] ?? 'Your campaign').toString(),
        description:
            'The minimum traveler count was not reached. Continue to planning or end the campaign.',
        buttonLabel: 'Decide now',
        icon: Icons.groups_2_rounded,
        color: const Color(0xFFB45309),
        onTap: () => widget.onOpenTrips(0),
      );
    }

    final planning = find((item) {
      final phase = (item['lifecyclePhase'] ?? '').toString().toLowerCase();
      final plan = item['planning'];
      return phase == 'planning' &&
          (plan is! Map || plan['isComplete'] != true);
    });
    if (planning != null) {
      return _HomeActionData(
        eyebrow: 'PLANNING IN PROGRESS',
        title: (planning['title'] ?? 'Complete your trip plan').toString(),
        description:
            'Finish the meeting point, transport, costs and traveler tasks.',
        buttonLabel: 'Continue planning',
        icon: Icons.fact_check_rounded,
        color: AppColors.navy,
        onTap: () => widget.onOpenTrips(0),
      );
    }

    final ongoing = find(
      (item) =>
          (item['lifecyclePhase'] ?? '').toString().toLowerCase() == 'started',
    );
    if (ongoing != null) {
      return _HomeActionData(
        eyebrow: 'HAPPENING NOW',
        title: (ongoing['title'] ?? 'Your trip is underway').toString(),
        description: 'Keep the route, campaign details and group chat close.',
        buttonLabel: 'View ongoing trip',
        icon: Icons.directions_walk_rounded,
        color: const Color(0xFF176B55),
        onTap: () => widget.onOpenTrips(1),
      );
    }

    return null;
  }

  Map<String, dynamic>? _nextUpcoming(
    List<Map<String, dynamic>> campaigns,
  ) {
    final now = DateTime.now();
    final future = campaigns.where((item) {
      final date = DateTime.tryParse((item['startDate'] ?? '').toString());
      final phase = (item['lifecyclePhase'] ?? '').toString().toLowerCase();
      return date != null &&
          date.isAfter(now) &&
          phase != 'cancelled' &&
          phase != 'completed';
    }).toList()
      ..sort((a, b) => DateTime.parse(a['startDate'].toString())
          .compareTo(DateTime.parse(b['startDate'].toString())));
    return future.isEmpty ? null : future.first;
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final campaignProvider = context.watch<CampaignsProvider>();
    final campaigns = campaignProvider.createdCampaigns;
    final discoveries = campaignProvider.campaigns
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .take(2)
        .toList(growable: false);
    final photoUrl = (_profile?['profilePhoto'] ?? '').toString().trim();
    final firstName = (_profile?['firstName'] ?? '').toString().trim();
    final rankCode =
        (_profile?['experienceLevel'] ?? 'F').toString().trim().toUpperCase();
    final rankProgress = _rankProgressValue(_profile);
    final rankColor = _rankGaugeColor(rankCode);
    final progress = _profile?['nextRankProgress'];
    final nextRank =
        progress is Map ? (progress['nextRank'] ?? '').toString().trim() : '';
    final xpToNext =
        progress is Map ? (progress['xpToNextRank'] as num?)?.toInt() : null;
    final totalXp = (_profile?['totalXp'] as num?)?.toInt() ?? 0;
    final nextAction = _nextAction(campaigns);
    final upcoming = _nextUpcoming(campaigns);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 68,
        title: Text(AppLocalizations.of(context).appName),
        actions: [
          IconButton(
            tooltip: AppLocalizations.of(context).changeLanguage,
            onPressed: () => context.read<AppLocaleController>().toggle(),
            icon: const Icon(Icons.translate_rounded),
          ),
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
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        RankBadgeIcon(
                          rankCode: rankCode,
                          badge: _profile?['currentRankBadge'],
                          size: 15,
                        ),
                        const SizedBox(width: 3),
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
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _refresh,
        child: ListView(
          key: const PageStorageKey('dashboard-home'),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          children: [
            Text(
              '${_greeting()}, ${firstName.isEmpty ? 'explorer' : firstName}',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: AppColors.navy,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -.4,
                  ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Here is what matters for your journey today.',
              style: TextStyle(color: AppColors.muted),
            ),
            if (nextAction != null) ...[
              const SizedBox(height: 18),
              _HomeActionCard(action: nextAction),
            ],
            const SizedBox(height: 14),
            _RankProgressCard(
              rankCode: rankCode,
              badge: _profile?['currentRankBadge'],
              progress: rankProgress,
              progressColor: rankColor,
              totalXp: totalXp,
              nextRank: nextRank,
              xpToNext: xpToNext,
              onTap: _openProfile,
            ),
            const SizedBox(height: 14),
            _JourneySnapshot(
              hosted: campaigns.length,
              active: campaignProvider.openCreatedCampaigns.length,
              completed: campaignProvider.expiredCreatedCampaigns.length,
            ),
            const SizedBox(height: 22),
            const _DashboardSectionTitle(
              title: 'Quick actions',
              subtitle: 'Start with one tap',
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _QuickAction(
                    icon: Icons.add_road_rounded,
                    label: 'Plan trip',
                    onTap: _createTrip,
                  ),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: _QuickAction(
                    icon: Icons.key_rounded,
                    label: 'Join code',
                    onTap: _openPrivateCampaignFinder,
                  ),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: _QuickAction(
                    icon: Icons.map_rounded,
                    label: 'Open map',
                    onTap: () => widget.onSelectPage(4),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _DashboardSectionTitle(
              title: 'Upcoming',
              subtitle: upcoming == null
                  ? 'Nothing scheduled yet'
                  : 'Your nearest scheduled journey',
            ),
            const SizedBox(height: 10),
            if (upcoming == null)
              _DashboardEmptyUpcoming(
                onTap: () => widget.onSelectPage(2),
              )
            else
              _UpcomingJourneyCard(
                campaign: upcoming,
                onTap: () => widget.onOpenTrips(0),
              ),
            const SizedBox(height: 22),
            _DashboardSectionTitle(
              title: 'Discover campaigns',
              subtitle: discoveries.isEmpty
                  ? 'New journeys will appear here'
                  : 'From the TripSathi community',
            ),
            const SizedBox(height: 10),
            if (discoveries.isEmpty)
              _DashboardEmptyDiscovery(
                onTap: () => widget.onSelectPage(2),
              )
            else ...[
              ...discoveries.map(
                (campaign) => Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: _DiscoveryCampaignCard(
                    campaign: campaign,
                    onTap: () => widget.onSelectPage(2),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => widget.onSelectPage(2),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 17),
                  label: const Text('View all campaigns'),
                ),
              ),
            ],
            if (campaignProvider.loading) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(minHeight: 2),
            ],
          ],
        ),
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

  _NavigationDestination withLabel(String localizedLabel) =>
      _NavigationDestination(
        label: localizedLabel,
        icon: icon,
        selectedIcon: selectedIcon,
      );
}

class _HomeActionData {
  const _HomeActionData({
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.buttonLabel,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String eyebrow;
  final String title;
  final String description;
  final String buttonLabel;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

class _HomeActionCard extends StatelessWidget {
  const _HomeActionCard({required this.action});

  final _HomeActionData action;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: action.color,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: action.color.withValues(alpha: .2),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(action.icon, color: AppColors.gold),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    action.eyebrow,
                    style: const TextStyle(
                      color: Color(0xFFFFE3A5),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 15),
            Text(
              action.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 21,
                height: 1.15,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              action.description,
              style: const TextStyle(color: Colors.white70, height: 1.4),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: action.onTap,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.navy,
              ),
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(action.buttonLabel),
            ),
          ],
        ),
      );
}

class _RankProgressCard extends StatelessWidget {
  const _RankProgressCard({
    required this.rankCode,
    required this.badge,
    required this.progress,
    required this.progressColor,
    required this.totalXp,
    required this.nextRank,
    required this.xpToNext,
    required this.onTap,
  });

  final String rankCode;
  final Object? badge;
  final double progress;
  final Color progressColor;
  final int totalXp;
  final String nextRank;
  final int? xpToNext;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.line),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                RankBadgeIcon(rankCode: rankCode, badge: badge, size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Rank $rankCode · $totalXp XP',
                              style: const TextStyle(
                                color: AppColors.navy,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded,
                              color: AppColors.muted),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 7,
                          color: progressColor,
                          backgroundColor: AppColors.line,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        nextRank.isEmpty
                            ? 'Your highest journey rank'
                            : '${xpToNext ?? 0} XP until Rank $nextRank',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
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

class _JourneySnapshot extends StatelessWidget {
  const _JourneySnapshot({
    required this.hosted,
    required this.active,
    required this.completed,
  });

  final int hosted;
  final int active;
  final int completed;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4F1),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            _JourneyMetric(value: hosted, label: 'Hosted'),
            const _JourneyMetricDivider(),
            _JourneyMetric(value: active, label: 'Open'),
            const _JourneyMetricDivider(),
            _JourneyMetric(value: completed, label: 'History'),
          ],
        ),
      );
}

class _JourneyMetric extends StatelessWidget {
  const _JourneyMetric({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: [
            Text(
              '$value',
              style: const TextStyle(
                color: AppColors.navy,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(color: AppColors.muted, fontSize: 10),
            ),
          ],
        ),
      );
}

class _JourneyMetricDivider extends StatelessWidget {
  const _JourneyMetricDivider();

  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        height: 28,
        color: AppColors.line,
      );
}

class _DashboardSectionTitle extends StatelessWidget {
  const _DashboardSectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: AppColors.navy,
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
        ],
      );
}

class _UpcomingJourneyCard extends StatelessWidget {
  const _UpcomingJourneyCard({required this.campaign, required this.onTap});

  final Map<String, dynamic> campaign;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final start =
        DateTime.tryParse((campaign['startDate'] ?? '').toString())?.toLocal();
    final location = [campaign['placeName'], campaign['district']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: .18),
            borderRadius: BorderRadius.circular(15),
          ),
          child:
              const Icon(Icons.event_available_rounded, color: AppColors.navy),
        ),
        title: Text(
          (campaign['title'] ?? 'Upcoming journey').toString(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Text(
          [
            if (location.isNotEmpty) location,
            if (start != null) '${start.day}/${start.month}/${start.year}',
            campaignStatusLabel(campaign),
          ].join(' · '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}

class _DashboardEmptyUpcoming extends StatelessWidget {
  const _DashboardEmptyUpcoming({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            const Icon(Icons.explore_outlined, color: AppColors.navy),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Find a campaign and put your next journey on the calendar.',
                style: TextStyle(color: AppColors.muted, height: 1.35),
              ),
            ),
            TextButton(onPressed: onTap, child: const Text('Explore')),
          ],
        ),
      );
}

class _DiscoveryCampaignCard extends StatelessWidget {
  const _DiscoveryCampaignCard({
    required this.campaign,
    required this.onTap,
  });

  final Map<String, dynamic> campaign;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = (campaign['title'] ?? 'Community campaign').toString();
    final location = [campaign['placeName'], campaign['district']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final category = (campaign['category'] ?? '').toString().trim();
    final details = [
      if (location.isNotEmpty) location,
      if (category.isNotEmpty) category,
    ].join(' · ');

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppColors.line),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F3EE),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.landscape_rounded,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (details.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        details,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                    const SizedBox(height: 5),
                    Text(
                      campaignStatusLabel(campaign),
                      style: const TextStyle(
                        color: AppColors.navyLight,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardEmptyDiscovery extends StatelessWidget {
  const _DashboardEmptyDiscovery({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.travel_explore_rounded,
              color: AppColors.navyLight,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Browse community campaigns and find people to travel with.',
                style: TextStyle(color: AppColors.muted, height: 1.3),
              ),
            ),
            TextButton(onPressed: onTap, child: const Text('Browse')),
          ],
        ),
      );
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
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          color: Colors.white,
        ),
        child: Column(
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
            const SizedBox(height: 8),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
            ),
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
