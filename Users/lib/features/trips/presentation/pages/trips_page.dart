import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/create_trip_wizard.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

class TripsListScreen extends StatefulWidget {
  const TripsListScreen({super.key});

  @override
  State<TripsListScreen> createState() => _TripsListScreenState();
}

class _TripsListScreenState extends State<TripsListScreen> {
  late TripsProvider _tripsProvider;

  @override
  void initState() {
    super.initState();
    _tripsProvider = context.read<TripsProvider>();
    _tripsProvider.loadTrips();
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
        body: Consumer<TripsProvider>(
          builder: (context, provider, _) {
            if (provider.loading && provider.trips.isEmpty) {
              return const _TripsLoading();
            }
            if (provider.error != null && provider.trips.isEmpty) {
              return _TripsError(
                message: ApiService.readableError(provider.error!),
                onRetry: provider.loadTrips,
              );
            }
            if (provider.trips.isEmpty) {
              return _TripsEmpty(onCreate: _openCreateTrip);
            }
            return RefreshIndicator(
              color: AppColors.navy,
              onRefresh: provider.loadTrips,
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 100),
                physics: const AlwaysScrollableScrollPhysics(),
                itemCount: provider.trips.length,
                itemBuilder: (context, index) =>
                    TripCard(trip: provider.trips[index]),
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
