import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';

class MyJourneysPage extends StatefulWidget {
  const MyJourneysPage({super.key});

  @override
  State<MyJourneysPage> createState() => _MyJourneysPageState();
}

class _MyJourneysPageState extends State<MyJourneysPage> {
  late CampaignsProvider _provider;
  int _selectedFilter = 0;

  @override
  void initState() {
    super.initState();
    _provider = context.read<CampaignsProvider>();
    _provider.loadCampaigns();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF5F4EF),
        appBar: AppBar(
          backgroundColor: const Color(0xFFF5F4EF),
          title: const Text('My journeys'),
          actions: [
            IconButton(
              tooltip: 'Refresh journey history',
              onPressed: _provider.loadCampaigns,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: Consumer<CampaignsProvider>(
          builder: (context, provider, _) {
            final journeys = provider.expiredCreatedCampaigns;
            final filteredJourneys = journeys.where((journey) {
              if (_selectedFilter == 0) return true;
              final completed = _isCompletedJourney(journey);
              return _selectedFilter == 1 ? completed : !completed;
            }).toList(growable: false);
            if (provider.loading && journeys.isEmpty) {
              return const _JourneySkeleton();
            }
            if (provider.error != null && journeys.isEmpty) {
              return _JourneyError(
                message: provider.error!,
                onRetry: provider.loadCampaigns,
              );
            }
            if (journeys.isEmpty) return const _NoJourneyHistory();
            return RefreshIndicator(
              color: AppColors.navy,
              onRefresh: provider.loadCampaigns,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  _JourneySummary(journeys: journeys),
                  const SizedBox(height: 16),
                  _JourneyFilters(
                    selectedIndex: _selectedFilter,
                    allCount: journeys.length,
                    completedCount: journeys.where(_isCompletedJourney).length,
                    expiredCount: journeys
                        .where((item) => !_isCompletedJourney(item))
                        .length,
                    onSelected: (index) =>
                        setState(() => _selectedFilter = index),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'JOURNEY ARCHIVE',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (filteredJourneys.isEmpty)
                    _NoFilteredJourneys(completed: _selectedFilter == 1)
                  else
                    ...filteredJourneys.map(
                      (journey) => _JourneyCard(journey: journey),
                    ),
                ],
              ),
            );
          },
        ),
      );
}

class _JourneyFilters extends StatelessWidget {
  const _JourneyFilters({
    required this.selectedIndex,
    required this.allCount,
    required this.completedCount,
    required this.expiredCount,
    required this.onSelected,
  });

  final int selectedIndex;
  final int allCount;
  final int completedCount;
  final int expiredCount;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: const Color(0xFFE8EBE6),
          borderRadius: BorderRadius.circular(17),
        ),
        child: Row(
          children: [
            _JourneyFilter(
              label: 'All',
              count: allCount,
              selected: selectedIndex == 0,
              onTap: () => onSelected(0),
            ),
            _JourneyFilter(
              label: 'Completed',
              count: completedCount,
              selected: selectedIndex == 1,
              onTap: () => onSelected(1),
            ),
            _JourneyFilter(
              label: 'Expired',
              count: expiredCount,
              selected: selectedIndex == 2,
              onTap: () => onSelected(2),
            ),
          ],
        ),
      );
}

class _JourneyFilter extends StatelessWidget {
  const _JourneyFilter({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Material(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(13),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(13),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$count',
                    style: TextStyle(
                      color: selected ? AppColors.navy : AppColors.muted,
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: TextStyle(
                      color: selected ? AppColors.navy : AppColors.muted,
                      fontSize: 10,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

class _NoFilteredJourneys extends StatelessWidget {
  const _NoFilteredJourneys({required this.completed});

  final bool completed;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 30),
        child: Column(
          children: [
            const Icon(Icons.route_outlined, color: AppColors.muted, size: 38),
            const SizedBox(height: 10),
            Text(
              completed ? 'No completed journeys yet' : 'No expired journeys',
              style: const TextStyle(
                color: AppColors.navy,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
}

class _JourneySummary extends StatelessWidget {
  const _JourneySummary({required this.journeys});
  final List<Map<String, dynamic>> journeys;

  @override
  Widget build(BuildContext context) {
    final completed = journeys.where((item) {
      final phase = (item['lifecyclePhase'] ?? '').toString();
      return item['completed'] == true || phase == 'completed';
    }).length;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF173F38), Color(0xFF28685A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(27),
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(19),
            ),
            child: const Icon(Icons.auto_stories_outlined,
                color: AppColors.gold, size: 28),
          ),
          const SizedBox(width: 15),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'The paths behind you',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Completed and expired trips stay here as part of your travel story.',
                  style: TextStyle(color: Color(0xFFC9DDD6), height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            children: [
              Text(
                '${journeys.length}',
                style: const TextStyle(
                  color: AppColors.gold,
                  fontSize: 25,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                completed == journeys.length ? 'finished' : 'archived',
                style: const TextStyle(color: Colors.white60, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _JourneyCard extends StatelessWidget {
  const _JourneyCard({required this.journey});
  final Map<String, dynamic> journey;

  @override
  Widget build(BuildContext context) {
    final phase = (journey['lifecyclePhase'] ?? '').toString().toLowerCase();
    final failed = journey['failed'] == true;
    final cancelled = phase == 'cancelled';
    final outcome = failed
        ? 'Expired'
        : cancelled
            ? 'Cancelled'
            : 'Completed';
    final date = DateTime.tryParse(
      (journey['endDate'] ?? journey['startDate'] ?? '').toString(),
    )?.toLocal();
    final location = [journey['placeName'], journey['district']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final photos = journey['photos'];
    final image = photos is List && photos.isNotEmpty && photos.first is Map
        ? ApiService.autoOrientCloudinaryImage(
            ((photos.first as Map)['url'] ?? '').toString(),
          )
        : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 92,
            height: 112,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF76968B), Color(0xFF385D53)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              image: image.isEmpty
                  ? null
                  : DecorationImage(
                      image: NetworkImage(image), fit: BoxFit.contain),
            ),
            child: image.isEmpty
                ? const Icon(Icons.landscape_outlined,
                    color: Colors.white70, size: 31)
                : null,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          (journey['title'] ?? 'Untitled journey').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.navy,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 7),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 4),
                        decoration: BoxDecoration(
                          color: failed || cancelled
                              ? const Color(0xFFFFECE9)
                              : const Color(0xFFEBF2EE),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          outcome,
                          style: TextStyle(
                            color: failed || cancelled
                                ? const Color(0xFFB42318)
                                : const Color(0xFF28685A),
                            fontSize: 8.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    location.isEmpty ? 'Nepal' : location,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.event_available_outlined,
                          color: AppColors.muted, size: 15),
                      const SizedBox(width: 5),
                      Text(
                        date == null
                            ? 'Date unavailable'
                            : '${date.day}/${date.month}/${date.year}',
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 10),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NoJourneyHistory extends StatelessWidget {
  const _NoJourneyHistory();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(38),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.history_toggle_off_rounded,
                  color: AppColors.muted, size: 58),
              SizedBox(height: 16),
              Text(
                'Your journey archive is empty',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.navy,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 7),
              Text(
                'Trips move here automatically after they finish or expire.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
      );
}

class _JourneyError extends StatelessWidget {
  const _JourneyError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined,
                  color: AppColors.muted, size: 44),
              const SizedBox(height: 13),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 15),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}

class _JourneySkeleton extends StatelessWidget {
  const _JourneySkeleton();

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (_, index) => Container(
          height: index == 0 ? 130 : 112,
          margin: const EdgeInsets.only(bottom: 11),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.line),
          ),
        ),
      );
}

bool _isCompletedJourney(Map<String, dynamic> journey) {
  final phase = (journey['lifecyclePhase'] ?? '').toString().toLowerCase();
  final status = (journey['status'] ?? '').toString().toLowerCase();
  return journey['completed'] == true ||
      phase == 'completed' ||
      status == 'completed';
}
