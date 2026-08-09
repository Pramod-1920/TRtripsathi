import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';

class CampaignsListScreen extends StatefulWidget {
  const CampaignsListScreen({super.key});

  @override
  State<CampaignsListScreen> createState() => _CampaignsListScreenState();
}

class _CampaignsListScreenState extends State<CampaignsListScreen> {
  late CampaignsProvider _campaignsProvider;
  String _currentUserId = '';

  @override
  void initState() {
    super.initState();
    _campaignsProvider = context.read<CampaignsProvider>();
    _campaignsProvider.loadCampaigns();
    _loadIdentity();
  }

  Future<void> _loadIdentity() async {
    try {
      final profile = await ApiService.getProfile();
      if (!mounted) return;
      setState(() => _currentUserId = _idOf(profile));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF6F7F3),
        appBar: AppBar(
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Campaigns'),
              Text(
                'Trips built by the community',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Refresh campaigns',
              onPressed: () => _campaignsProvider.loadCampaigns(),
              icon: const Icon(Icons.refresh_rounded),
            ),
            const SizedBox(width: 5),
          ],
        ),
        body: Consumer<CampaignsProvider>(
          builder: (context, provider, _) {
            if (provider.loading && provider.campaigns.isEmpty) {
              return const _CampaignLoading();
            }
            if (provider.error != null && provider.campaigns.isEmpty) {
              return _CampaignError(
                message: provider.error!,
                onRetry: provider.loadCampaigns,
              );
            }
            if (provider.campaigns.isEmpty) return const _CampaignEmpty();
            return RefreshIndicator(
              color: AppColors.navy,
              onRefresh: provider.loadCampaigns,
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
                itemCount: provider.campaigns.length,
                itemBuilder: (context, index) {
                  final raw = provider.campaigns[index];
                  final campaign = raw is Map
                      ? Map<String, dynamic>.from(raw)
                      : <String, dynamic>{};
                  final owned = _isOwned(campaign, _currentUserId);
                  return CampaignCard(
                    campaign: campaign,
                    owned: owned,
                    onJoin: () => _joinCampaign(_idOf(campaign)),
                  );
                },
              ),
            );
          },
        ),
      );

  Future<void> _joinCampaign(String campaignId) async {
    if (campaignId.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _campaignsProvider.joinCampaign(campaignId);
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text('You joined the campaign.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    }
  }
}

class CampaignCard extends StatelessWidget {
  const CampaignCard({
    super.key,
    required this.campaign,
    required this.owned,
    required this.onJoin,
  });
  final Map<String, dynamic> campaign;
  final bool owned;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final title = (campaign['title'] ?? 'Untitled campaign').toString();
    final description = (campaign['description'] ?? '').toString().trim();
    final phase = (campaign['lifecyclePhase'] ?? 'draft').toString();
    final approval = (campaign['approvalStatus'] ?? 'draft').toString();
    final location = [
      campaign['placeName'],
      campaign['district'],
      campaign['province'],
    ]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .join(', ');
    final photos = campaign['photos'];
    final firstPhoto =
        photos is List && photos.isNotEmpty && photos.first is Map
            ? ((photos.first as Map)['url'] ?? '').toString()
            : '';
    final canJoin = !owned && approval == 'approved' && phase == 'open';
    return Container(
      margin: const EdgeInsets.only(bottom: 13),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 116,
            decoration: BoxDecoration(
              gradient: firstPhoto.isEmpty
                  ? const LinearGradient(
                      colors: [Color(0xFF28685A), Color(0xFF17324D)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
              image: firstPhoto.isEmpty
                  ? null
                  : DecorationImage(
                      image: NetworkImage(firstPhoto),
                      fit: BoxFit.cover,
                    ),
            ),
            child: Stack(
              children: [
                if (firstPhoto.isEmpty)
                  Positioned(
                    right: 16,
                    bottom: -16,
                    child: Icon(
                      Icons.landscape_rounded,
                      color: Colors.white.withValues(alpha: .12),
                      size: 118,
                    ),
                  ),
                Positioned(
                  left: 14,
                  top: 14,
                  child: _CampaignPill(
                    label: owned ? 'YOUR TRIP' : _campaignLabel(phase),
                    strong: owned,
                  ),
                ),
                Positioned(
                  right: 14,
                  top: 14,
                  child: _CampaignPill(
                    label: _campaignLabel(
                        (campaign['hikeType'] ?? 'group').toString()),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(17),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(color: AppColors.muted, height: 1.35),
                  ),
                ],
                const SizedBox(height: 13),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined,
                        color: AppColors.muted, size: 17),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        location.isEmpty
                            ? 'Location to be confirmed'
                            : location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 13),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    _CampaignTag(
                      icon: Icons.hiking_rounded,
                      label: (campaign['category'] ?? 'Activity').toString(),
                    ),
                    _CampaignTag(
                      icon: Icons.terrain_rounded,
                      label: _campaignLabel(
                          (campaign['difficulty'] ?? 'Flexible').toString()),
                    ),
                    _CampaignTag(
                      icon: Icons.timelapse_rounded,
                      label: '${campaign['durationDays'] ?? 1} day',
                    ),
                  ],
                ),
                const SizedBox(height: 15),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        owned
                            ? approval == 'submitted'
                                ? 'Waiting for Admin approval'
                                : 'Published in Campaigns'
                            : canJoin
                                ? 'Open for travelers'
                                : _campaignLabel(phase),
                        style: const TextStyle(
                          color: Color(0xFF28685A),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (canJoin)
                      FilledButton.icon(
                        onPressed: onJoin,
                        icon: const Icon(Icons.person_add_alt_1_rounded,
                            size: 17),
                        label: const Text('Join'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.navy,
                          foregroundColor: Colors.white,
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 11, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEBF2EE),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Icon(
                          owned
                              ? Icons.shield_outlined
                              : Icons.lock_clock_outlined,
                          color: const Color(0xFF28685A),
                          size: 18,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CampaignPill extends StatelessWidget {
  const _CampaignPill({required this.label, this.strong = false});
  final String label;
  final bool strong;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(
          color: strong ? AppColors.gold : Colors.black.withValues(alpha: .46),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: strong ? AppColors.navy : Colors.white,
            fontSize: 9.5,
            fontWeight: FontWeight.w900,
          ),
        ),
      );
}

class _CampaignTag extends StatelessWidget {
  const _CampaignTag({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFF2F3EF),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.navy, size: 14),
            const SizedBox(width: 5),
            Text(label,
                style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 10,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      );
}

class _CampaignEmpty extends StatelessWidget {
  const _CampaignEmpty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(36),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.explore_off_outlined,
                  color: AppColors.muted, size: 54),
              SizedBox(height: 16),
              Text(
                'No campaigns are open yet',
                style: TextStyle(
                  color: AppColors.navy,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 7),
              Text(
                'Use Plan a trip from Trips to start one.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted),
              ),
            ],
          ),
        ),
      );
}

class _CampaignError extends StatelessWidget {
  const _CampaignError({required this.message, required this.onRetry});
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

class _CampaignLoading extends StatelessWidget {
  const _CampaignLoading();

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          height: 300,
          margin: const EdgeInsets.only(bottom: 13),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(25),
            border: Border.all(color: AppColors.line),
          ),
        ),
      );
}

String _idOf(dynamic value) {
  if (value is Map) return (value['_id'] ?? value['id'] ?? '').toString();
  return (value ?? '').toString();
}

bool _isOwned(Map<String, dynamic> campaign, String currentUserId) {
  if (campaign['_createdByCurrentUser'] == true) return true;
  if (currentUserId.isEmpty) return false;
  return _idOf(campaign['hostId']) == currentUserId ||
      _idOf(campaign['creator']) == currentUserId;
}

String _campaignLabel(String value) => value
    .trim()
    .toLowerCase()
    .split(RegExp(r'[_\s]+'))
    .where((part) => part.isNotEmpty)
    .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
