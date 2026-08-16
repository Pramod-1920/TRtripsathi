import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/domain/campaign_lifecycle.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/create_trip_wizard.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trip_details_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

class TripsListScreen extends StatefulWidget {
  const TripsListScreen({this.initialFilter = 0, super.key});

  final int initialFilter;

  @override
  State<TripsListScreen> createState() => _TripsListScreenState();
}

class _TripsListScreenState extends State<TripsListScreen> {
  late TripsProvider _tripsProvider;
  late CampaignsProvider _campaignsProvider;
  late int _myTripsFilter;
  String? _decidingCampaignId;

  @override
  void initState() {
    super.initState();
    _myTripsFilter = widget.initialFilter.clamp(0, 2);
    _tripsProvider = context.read<TripsProvider>();
    _campaignsProvider = context.read<CampaignsProvider>();
    if (!_tripsProvider.hasLoaded) _tripsProvider.loadTrips();
    if (!_campaignsProvider.hasLoaded) _campaignsProvider.loadCampaigns();
  }

  Future<void> _openCreateTrip() async {
    final created = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => const CreateTripWizard()),
    );
    if (created == null || !mounted) return;
    final title = (created['title'] ?? 'Your trip').toString();
    final isPrivate = created['visibility'] == 'private';
    final code = (created['campaignCode'] ?? '').toString();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isPrivate
              ? '$title is private. Share code $code to invite travelers.'
              : '$title was published to Campaigns.',
        ),
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

  void _openTripDetails(Map<String, dynamic> trip, {bool campaign = false}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TripDetailsScreen(
          initialTrip: trip,
          isCampaign: campaign,
        ),
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

  Future<void> _submitCompletionEvidence(
    Map<String, dynamic> campaign,
  ) async {
    final choice = await showModalBottomSheet<_EvidenceChoice>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Verify your trip',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              const Text(
                'Upload one photo or video before the 24-hour deadline. Valid evidence completes the trip and awards XP automatically.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: const Icon(Icons.add_a_photo_outlined),
                title: const Text('Take a photo'),
                onTap: () => Navigator.pop(
                  sheetContext,
                  const _EvidenceChoice('image', ImageSource.camera),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose a photo'),
                onTap: () => Navigator.pop(
                  sheetContext,
                  const _EvidenceChoice('image', ImageSource.gallery),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.video_library_outlined),
                title: const Text('Choose a video'),
                onTap: () => Navigator.pop(
                  sheetContext,
                  const _EvidenceChoice('video', ImageSource.gallery),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (choice == null || !mounted) return;

    var progressDialogShown = false;
    try {
      final picker = ImagePicker();
      final picked = choice.mediaType == 'video'
          ? await picker.pickVideo(
              source: choice.source,
              maxDuration: const Duration(minutes: 2),
            )
          : await picker.pickImage(
              source: choice.source,
              imageQuality: 85,
              maxWidth: 2048,
            );
      if (picked == null || !mounted) return;

      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const AlertDialog(
          content: Row(
            children: [
              CircularProgressIndicator(),
              SizedBox(width: 18),
              Expanded(child: Text('Uploading and verifying evidence...')),
            ],
          ),
        ),
      );
      progressDialogShown = true;

      final evidence = await ApiService.uploadCampaignEvidence(
        File(picked.path),
        mediaType: choice.mediaType,
      );
      final campaignId = (campaign['_id'] ?? campaign['id'] ?? '').toString();
      await _campaignsProvider.verifyOwnedCampaign(campaignId, evidence);
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Trip verified. Your XP was awarded automatically.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      if (progressDialogShown) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    }
  }

  Future<void> _decideMinimumParticipants(
    Map<String, dynamic> campaign,
  ) async {
    final campaignId = (campaign['_id'] ?? campaign['id'] ?? '').toString();
    if (campaignId.isEmpty || _decidingCampaignId != null) return;
    final participants = campaign['participants'] is List
        ? campaign['participants'] as List
        : const [];
    final accepted = participants.where((participant) {
      return participant is Map && participant['status'] == 'accepted';
    }).length;
    final minimum = (campaign['minParticipants'] as num?)?.toInt() ?? 1;
    final decision = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Not enough travelers'),
        content: Text(
          '$accepted traveler${accepted == 1 ? '' : 's'} joined, but the minimum is $minimum. You can continue to planning with the current group or end this campaign.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Decide later'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, 'end'),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('End campaign'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, 'continue'),
            child: const Text('Continue to planning'),
          ),
        ],
      ),
    );
    if (decision == null || !mounted) return;

    setState(() => _decidingCampaignId = campaignId);
    try {
      await _campaignsProvider.decideMinimumParticipants(
        campaignId,
        decision,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'continue'
                ? 'Campaign moved to planning.'
                : 'Campaign ended.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    } finally {
      if (mounted) setState(() => _decidingCampaignId = null);
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
            final myTrips = switch (_myTripsFilter) {
              0 => campaignsProvider.openCreatedCampaigns,
              1 => campaignsProvider.ongoingCreatedCampaigns,
              _ => campaignsProvider.expiredCreatedCampaigns,
            };
            if ((tripsProvider.loading || campaignsProvider.loading) &&
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
                    finishedCount:
                        campaignsProvider.expiredCreatedCampaigns.length,
                    trips: myTrips,
                    onFilterChanged: (value) =>
                        setState(() => _myTripsFilter = value),
                    onCreate: _openCreateTrip,
                    onEdit: _editTrip,
                    onDelete: _deleteTrip,
                    onVerify: _submitCompletionEvidence,
                    onMinimumParticipantDecision: _decideMinimumParticipants,
                    decidingCampaignId: _decidingCampaignId,
                    onOpen: (trip) => _openTripDetails(trip, campaign: true),
                    loading: campaignsProvider.loading,
                  ),
                  if (tripsProvider.trips.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const _ListHeading(
                      title: 'Discover trips',
                      subtitle: 'Journeys from the TripSathi community',
                    ),
                    const SizedBox(height: 11),
                    ...tripsProvider.trips.map(
                      (trip) => TripCard(
                        trip: trip,
                        onTap: () => _openTripDetails(
                          Map<String, dynamic>.from(trip as Map),
                        ),
                      ),
                    ),
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
  const TripCard({super.key, required this.trip, required this.onTap});
  final dynamic trip;
  final VoidCallback onTap;

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
        onTap: onTap,
      ),
    );
  }
}

class _MyTripsPanel extends StatelessWidget {
  const _MyTripsPanel({
    required this.selectedFilter,
    required this.openCount,
    required this.ongoingCount,
    required this.finishedCount,
    required this.trips,
    required this.onFilterChanged,
    required this.onCreate,
    required this.onEdit,
    required this.onDelete,
    required this.onVerify,
    required this.onMinimumParticipantDecision,
    required this.decidingCampaignId,
    required this.onOpen,
    required this.loading,
  });
  final int selectedFilter;
  final int openCount;
  final int ongoingCount;
  final int finishedCount;
  final List<Map<String, dynamic>> trips;
  final ValueChanged<int> onFilterChanged;
  final VoidCallback onCreate;
  final ValueChanged<Map<String, dynamic>> onEdit;
  final ValueChanged<Map<String, dynamic>> onDelete;
  final ValueChanged<Map<String, dynamic>> onVerify;
  final ValueChanged<Map<String, dynamic>> onMinimumParticipantDecision;
  final String? decidingCampaignId;
  final ValueChanged<Map<String, dynamic>> onOpen;
  final bool loading;

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
                Expanded(
                  child: _TripFilter(
                    label: 'Finished',
                    count: finishedCount,
                    selected: selectedFilter == 2,
                    onTap: () => onFilterChanged(2),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 11),
          if (loading && trips.isEmpty)
            const _MyTripsLoadingCard()
          else if (trips.isEmpty)
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
                onVerify: () => onVerify(trip),
                onMinimumParticipantDecision: () =>
                    onMinimumParticipantDecision(trip),
                deciding: decidingCampaignId ==
                    (trip['_id'] ?? trip['id'] ?? '').toString(),
                onOpen: () => onOpen(trip),
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
    required this.onVerify,
    required this.onMinimumParticipantDecision,
    required this.deciding,
    required this.onOpen,
  });
  final Map<String, dynamic> campaign;
  final bool ongoing;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onVerify;
  final VoidCallback onMinimumParticipantDecision;
  final bool deciding;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final location = [campaign['placeName'], campaign['district']]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final awaitingVerification = campaign['awaitingVerification'] == true;
    final decisionRequired =
        campaign['minimumParticipantDecisionRequired'] == true;
    final displayStatus = campaignStatusLabel(campaign);
    final privateCode = campaign['visibility'] == 'private'
        ? (campaign['campaignCode'] ?? '').toString()
        : '';
    final date =
        DateTime.tryParse((campaign['startDate'] ?? '').toString())?.toLocal();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: ongoing ? const Color(0xFF173F38) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(
            color: ongoing ? const Color(0xFF173F38) : AppColors.line,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              children: [
                Row(
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
                        ongoing
                            ? Icons.directions_walk_rounded
                            : Icons.flag_outlined,
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
                              if (date != null)
                                '${date.day}/${date.month}/${date.year}',
                            ].join('  •  '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: ongoing ? Colors.white60 : AppColors.muted,
                              fontSize: 11,
                            ),
                          ),
                          if (privateCode.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Private invite code: $privateCode',
                              style: TextStyle(
                                color:
                                    ongoing ? AppColors.gold : AppColors.navy,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(
                        color:
                            ongoing ? AppColors.gold : const Color(0xFFEBF2EE),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        decisionRequired
                            ? 'DECISION'
                            : ongoing
                                ? 'ONGOING'
                                : displayStatus.toUpperCase(),
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
                        if (action == 'verify') onVerify();
                        if (action == 'edit') onEdit();
                        if (action == 'delete') onDelete();
                      },
                      itemBuilder: (_) => [
                        if (awaitingVerification)
                          const PopupMenuItem(
                            value: 'verify',
                            child: ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(Icons.verified_outlined),
                              title: Text('Upload trip evidence'),
                            ),
                          ),
                        const PopupMenuItem(
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
                if (decisionRequired) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: ongoing
                          ? Colors.white.withValues(alpha: .1)
                          : AppColors.gold.withValues(alpha: .14),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.priority_high_rounded,
                          color: ongoing ? AppColors.gold : AppColors.navy,
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            'Minimum travelers not reached. Your decision is required.',
                            style: TextStyle(
                              color: ongoing ? Colors.white : AppColors.navy,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed:
                              deciding ? null : onMinimumParticipantDecision,
                          style: FilledButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                          ),
                          child: deciding
                              ? const SizedBox.square(
                                  dimension: 15,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Decide'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EvidenceChoice {
  const _EvidenceChoice(this.mediaType, this.source);

  final String mediaType;
  final ImageSource source;
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

class _TripsLoading extends StatefulWidget {
  const _TripsLoading();

  @override
  State<_TripsLoading> createState() => _TripsLoadingState();
}

class _TripsLoadingState extends State<_TripsLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Loading trips',
        child: ExcludeSemantics(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => ListView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
              children: [
                _SkeletonLine(animation: _controller.value, width: 92),
                const SizedBox(height: 7),
                _SkeletonLine(animation: _controller.value, width: 210),
                const SizedBox(height: 14),
                _SkeletonBox(animation: _controller.value, height: 48),
                const SizedBox(height: 11),
                _MyTripsLoadingCard(animation: _controller.value),
                const SizedBox(height: 24),
                _SkeletonLine(animation: _controller.value, width: 128),
                const SizedBox(height: 7),
                _SkeletonLine(animation: _controller.value, width: 230),
                const SizedBox(height: 14),
                for (var index = 0; index < 3; index++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _SkeletonBox(
                      animation: _controller.value,
                      height: 82,
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
}

class _MyTripsLoadingCard extends StatelessWidget {
  const _MyTripsLoadingCard({this.animation = .35});
  final double animation;

  @override
  Widget build(BuildContext context) => _SkeletonBox(
        animation: animation,
        height: 82,
      );
}

class _SkeletonLine extends StatelessWidget {
  const _SkeletonLine({required this.animation, required this.width});
  final double animation;
  final double width;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        child: _SkeletonBox(
          animation: animation,
          width: width,
          height: 12,
          radius: 7,
        ),
      );
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.animation,
    this.width = double.infinity,
    required this.height,
    this.radius = 22,
  });
  final double animation;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final highlight = -1.5 + (animation * 3);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.line.withValues(alpha: .7)),
        gradient: LinearGradient(
          begin: Alignment(highlight - 1, 0),
          end: Alignment(highlight + 1, 0),
          colors: const [
            Color(0xFFE9ECE7),
            Color(0xFFF7F8F5),
            Color(0xFFE9ECE7),
          ],
          stops: const [0, .5, 1],
        ),
      ),
    );
  }
}

String _tripLabel(dynamic value) => (value ?? 'Unknown')
    .toString()
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) =>
        part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
