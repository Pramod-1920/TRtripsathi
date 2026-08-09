import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/create_trip_wizard.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

class TripsListScreen extends StatefulWidget {
  const TripsListScreen({super.key});

  @override
  State<TripsListScreen> createState() => _TripsListScreenState();
}

class _TripsListScreenState extends State<TripsListScreen> {
  late TripsProvider _tripsProvider;
  late CampaignsProvider _campaignsProvider;
  int _myTripsFilter = 0;

  @override
  void initState() {
    super.initState();
    _tripsProvider = context.read<TripsProvider>();
    _campaignsProvider = context.read<CampaignsProvider>();
    _tripsProvider.loadTrips();
    _campaignsProvider.loadCampaigns();
  }

  Future<void> _openCreateTrip() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => const CreateTripWizard()),
    );
    if (created == null || !mounted) return;
    final title = (created['title'] ?? 'Your trip').toString();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$title was published to Campaigns.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _editTrip(Map<String, dynamic> campaign) async {
    final updated = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => CreateTripWizard(campaign: campaign),
      ),
    );
    if (updated == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Trip changes saved.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _deleteTrip(Map<String, dynamic> campaign) async {
    final title = (campaign['title'] ?? 'this trip').toString();
    final campaignId = (campaign['_id'] ?? campaign['id'] ?? '').toString();
    if (campaignId.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete this trip?'),
        content: Text(
          '“$title” will be permanently removed. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep trip'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _campaignsProvider.deleteOwnedCampaign(campaignId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Trip deleted.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF6F7F3),
        appBar: AppBar(
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Trips'),
              Text(
                'Discover routes or host your own',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        body: Consumer2<TripsProvider, CampaignsProvider>(
          builder: (context, tripsProvider, campaignsProvider, _) {
            final myTrips = _myTripsFilter == 0
                ? campaignsProvider.openCreatedCampaigns
                : campaignsProvider.ongoingCreatedCampaigns;
            if (tripsProvider.loading &&
                campaignsProvider.loading &&
                tripsProvider.trips.isEmpty &&
                myTrips.isEmpty) {
              return const _TripsLoading();
            }
            if (tripsProvider.error != null &&
                campaignsProvider.error != null &&
                tripsProvider.trips.isEmpty &&
                myTrips.isEmpty) {
              return _TripsError(
                message: ApiService.readableError(tripsProvider.error!),
                onRetry: _refresh,
              );
            }
            if (tripsProvider.trips.isEmpty &&
                campaignsProvider.openCreatedCampaigns.isEmpty &&
                campaignsProvider.ongoingCreatedCampaigns.isEmpty) {
              return _TripsEmpty(onCreate: _openCreateTrip);
            }
            return RefreshIndicator(
              color: AppColors.navy,
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 100),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  _MyTripsPanel(
                    selectedFilter: _myTripsFilter,
                    openCount: campaignsProvider.openCreatedCampaigns.length,
                    ongoingCount:
                        campaignsProvider.ongoingCreatedCampaigns.length,
                    trips: myTrips,
                    onFilterChanged: (value) =>
                        setState(() => _myTripsFilter = value),
                    onCreate: _openCreateTrip,
                    onEdit: _editTrip,
                    onDelete: _deleteTrip,
                  ),
                  if (tripsProvider.trips.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const _ListHeading(
                      title: 'Discover trips',
                      subtitle: 'Journeys from the TripSathi community',
                    ),
                    const SizedBox(height: 11),
                    ...tripsProvider.trips.map((trip) => TripCard(trip: trip)),
                  ],
                ],
              ),
            );
          },
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _openCreateTrip,
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          elevation: 5,
          icon: const Icon(Icons.add_road_rounded),
          label: const Text(
            'Plan a trip',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      );

  Future<void> _refresh() async {
    await Future.wait([
      _tripsProvider.loadTrips(),
      _campaignsProvider.loadCampaigns(),
    ]);
  }
}

class TripCard extends StatelessWidget {
  const TripCard({super.key, required this.trip});
  final dynamic trip;

  @override
  Widget build(BuildContext context) {
    final title = (trip['title'] ?? 'Untitled trip').toString();
    final location = [trip['district'], trip['province']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final status = (trip['status'] ?? 'draft').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.line),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(15),
        leading: Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: .18),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.route_rounded, color: AppColors.navy),
        ),
        title: Text(
          title,
          style: const TextStyle(
            color: AppColors.navy,
            fontWeight: FontWeight.w800,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            '${location.isEmpty ? 'Nepal' : location}  •  ${_tripLabel(trip['difficulty'])}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFEBF2EE),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            _tripLabel(status),
            style: const TextStyle(
              color: Color(0xFF28685A),
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Trip details: $title')),
        ),
      ),
    );
  }
}

class _MyTripsPanel extends StatelessWidget {
  const _MyTripsPanel({
    required this.selectedFilter,
    required this.openCount,
    required this.ongoingCount,
    required this.trips,
    required this.onFilterChanged,
    required this.onCreate,
    required this.onEdit,
    required this.onDelete,
  });
  final int selectedFilter;
  final int openCount;
  final int ongoingCount;
  final List<Map<String, dynamic>> trips;
  final ValueChanged<int> onFilterChanged;
  final VoidCallback onCreate;
  final ValueChanged<Map<String, dynamic>> onEdit;
  final ValueChanged<Map<String, dynamic>> onDelete;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _ListHeading(
            title: 'My trips',
            subtitle: 'Campaigns you created and currently manage',
          ),
          const SizedBox(height: 11),
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFFE8EBE6),
              borderRadius: BorderRadius.circular(17),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _TripFilter(
                    label: 'Open',
                    count: openCount,
                    selected: selectedFilter == 0,
                    onTap: () => onFilterChanged(0),
                  ),
                ),
                Expanded(
                  child: _TripFilter(
                    label: 'Ongoing',
                    count: ongoingCount,
                    selected: selectedFilter == 1,
                    onTap: () => onFilterChanged(1),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 11),
          if (trips.isEmpty)
            _MyTripsEmpty(
              ongoing: selectedFilter == 1,
              onCreate: onCreate,
            )
          else
            ...trips.map(
              (trip) => _MyTripCard(
                campaign: trip,
                ongoing: selectedFilter == 1,
                onEdit: () => onEdit(trip),
                onDelete: () => onDelete(trip),
              ),
            ),
        ],
      );
}

class _TripFilter extends StatelessWidget {
  const _TripFilter({
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
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(13),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(13),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.navy.withValues(alpha: .08),
                      blurRadius: 10,
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: selected ? AppColors.navy : AppColors.muted,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 7),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.gold.withValues(alpha: .24)
                      : Colors.white.withValues(alpha: .65),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _MyTripCard extends StatelessWidget {
  const _MyTripCard({
    required this.campaign,
    required this.ongoing,
    required this.onEdit,
    required this.onDelete,
  });
  final Map<String, dynamic> campaign;
  final bool ongoing;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final location = [campaign['placeName'], campaign['district']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final approval = (campaign['approvalStatus'] ?? '').toString();
    final phase = (campaign['lifecyclePhase'] ?? 'draft').toString();
    final date =
        DateTime.tryParse((campaign['startDate'] ?? '').toString())?.toLocal();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: ongoing ? const Color(0xFF173F38) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: ongoing ? const Color(0xFF173F38) : AppColors.line,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: ongoing
                  ? Colors.white.withValues(alpha: .12)
                  : AppColors.gold.withValues(alpha: .2),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(
              ongoing ? Icons.directions_walk_rounded : Icons.flag_outlined,
              color: ongoing ? AppColors.gold : AppColors.navy,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (campaign['title'] ?? 'Untitled trip').toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: ongoing ? Colors.white : AppColors.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  [
                    if (location.isNotEmpty) location,
                    if (date != null) '${date.day}/${date.month}/${date.year}',
                  ].join('  •  '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: ongoing ? Colors.white60 : AppColors.muted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(
              color: ongoing ? AppColors.gold : const Color(0xFFEBF2EE),
              borderRadius: BorderRadius.circular(99),
            ),
            child: Text(
              ongoing
                  ? 'ONGOING'
                  : approval == 'submitted'
                      ? 'REVIEW'
                      : _tripLabel(phase).toUpperCase(),
              style: const TextStyle(
                color: AppColors.navy,
                fontSize: 9,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 3),
          PopupMenuButton<String>(
            tooltip: 'Manage trip',
            color: Colors.white,
            onSelected: (action) {
              if (action == 'edit') onEdit();
              if (action == 'delete') onDelete();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'edit',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.edit_outlined),
                  title: Text('Edit trip'),
                ),
              ),
              PopupMenuItem(
                value: 'delete',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.delete_outline_rounded,
                      color: AppColors.danger),
                  title: Text('Delete trip'),
                ),
              ),
            ],
            icon: Icon(
              Icons.more_vert_rounded,
              color: ongoing ? Colors.white70 : AppColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}

class _MyTripsEmpty extends StatelessWidget {
  const _MyTripsEmpty({required this.ongoing, required this.onCreate});
  final bool ongoing;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            Icon(
              ongoing ? Icons.hourglass_empty_rounded : Icons.add_road_rounded,
              color: AppColors.muted,
              size: 30,
            ),
            const SizedBox(height: 9),
            Text(
              ongoing ? 'No trip is underway' : 'No open trip yet',
              style: const TextStyle(
                color: AppColors.navy,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (!ongoing) ...[
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: onCreate,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Plan one'),
              ),
            ],
          ],
        ),
      );
}

class _ListHeading extends StatelessWidget {
  const _ListHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(subtitle,
              style: const TextStyle(color: AppColors.muted, fontSize: 11)),
        ],
      );
}

class _TripsEmpty extends StatelessWidget {
  const _TripsEmpty({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(36),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: .18),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add_road_rounded,
                    color: AppColors.navy, size: 37),
              ),
              const SizedBox(height: 18),
              const Text(
                'Lead the first journey',
                style: TextStyle(
                  color: AppColors.navy,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Shape an idea into a scheduled campaign that other travelers can discover.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: onCreate,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Plan a trip'),
              ),
            ],
          ),
        ),
      );
}

class _TripsError extends StatelessWidget {
  const _TripsError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined,
                  color: AppColors.muted, size: 44),
              const SizedBox(height: 14),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
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

class _TripsLoading extends StatelessWidget {
  const _TripsLoading();

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: 5,
        itemBuilder: (_, __) => Container(
          height: 82,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.line),
          ),
        ),
      );
}

String _tripLabel(dynamic value) => (value ?? 'Unknown')
    .toString()
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) =>
        part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
