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
  final TextEditingController _searchController = TextEditingController();
  String _currentUserId = '';
  String _searchQuery = '';
  String _difficultyFilter = 'all';
  String _categoryFilter = 'all';

  int get _activeFilterCount => [
        _difficultyFilter,
        _categoryFilter,
      ].where((value) => value != 'all').length;

  List<String> get _availableCategories {
    final categories = _campaignsProvider.campaigns
        .whereType<Map>()
        .map((campaign) => (campaign['category'] ?? '').toString().trim())
        .where((category) => category.isNotEmpty)
        .toSet()
        .toList();
    categories.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return categories;
  }

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
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
              tooltip: 'Find private campaign',
              onPressed: _findPrivateCampaign,
              icon: const Icon(Icons.key_rounded),
            ),
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
            final campaigns = provider.campaigns
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .where(_matchesFilters)
                .toList(growable: false);
            return RefreshIndicator(
              color: AppColors.navy,
              onRefresh: provider.loadCampaigns,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
                children: [
                  _CampaignSearchBar(
                    controller: _searchController,
                    activeFilterCount: _activeFilterCount,
                    onChanged: (value) =>
                        setState(() => _searchQuery = value.trim()),
                    onSubmitted: (value) {
                      if (value.trim().startsWith('#')) {
                        _findPrivateCampaign(initialCode: value);
                      }
                    },
                    onFilterTap: _showFilters,
                  ),
                  if (_activeFilterCount > 0) ...[
                    const SizedBox(height: 10),
                    _ActiveCampaignFilters(
                      difficulty: _difficultyFilter,
                      category: _categoryFilter,
                      onClearDifficulty: () =>
                          setState(() => _difficultyFilter = 'all'),
                      onClearCategory: () =>
                          setState(() => _categoryFilter = 'all'),
                    ),
                  ],
                  const SizedBox(height: 14),
                  if (campaigns.isEmpty)
                    _NoCampaignMatches(onClear: _clearSearchAndFilters)
                  else ...[
                    Padding(
                      padding: const EdgeInsets.only(left: 2, bottom: 10),
                      child: Text(
                        '${campaigns.length} campaign${campaigns.length == 1 ? '' : 's'} found',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    ...campaigns.map((campaign) {
                      final owned = _isOwned(campaign, _currentUserId);
                      return CampaignCard(
                        campaign: campaign,
                        owned: owned,
                        onJoin: () => _joinCampaign(_idOf(campaign)),
                      );
                    }),
                  ],
                ],
              ),
            );
          },
        ),
      );

  bool _matchesFilters(Map<String, dynamic> campaign) {
    final query = _searchQuery.toLowerCase();
    final searchable = [
      campaign['title'],
      campaign['description'],
      campaign['placeName'],
      campaign['district'],
      campaign['province'],
      campaign['category'],
      campaign['campaignCode'],
    ].map((value) => (value ?? '').toString().toLowerCase()).join(' ');
    if (query.isNotEmpty && !searchable.contains(query)) return false;
    if (_difficultyFilter != 'all' &&
        (campaign['difficulty'] ?? '').toString().toLowerCase() !=
            _difficultyFilter) {
      return false;
    }
    if (_categoryFilter != 'all' &&
        (campaign['category'] ?? '').toString().toLowerCase() !=
            _categoryFilter) {
      return false;
    }
    return true;
  }

  void _clearSearchAndFilters() => setState(() {
        _searchController.clear();
        _searchQuery = '';
        _difficultyFilter = 'all';
        _categoryFilter = 'all';
      });

  Future<void> _showFilters() async {
    var difficulty = _difficultyFilter;
    var category = _categoryFilter;
    final categoryChoices = <String, String>{
      'all': 'Any',
      for (final item in _availableCategories) item.toLowerCase(): item,
    };
    final apply = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, updateSheet) => SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Filter campaigns',
                    style:
                        TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
                const SizedBox(height: 20),
                _FilterChoices(
                  label: 'Difficulty',
                  value: difficulty,
                  choices: const {
                    'all': 'Any',
                    'easy': 'Easy',
                    'moderate': 'Moderate',
                    'difficult': 'Difficult',
                    'expert': 'Expert',
                  },
                  onChanged: (value) => updateSheet(() => difficulty = value),
                ),
                const SizedBox(height: 18),
                _FilterChoices(
                  label: 'Category',
                  value: category,
                  choices: categoryChoices,
                  onChanged: (value) => updateSheet(() => category = value),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    TextButton(
                      onPressed: () => updateSheet(() {
                        difficulty = 'all';
                        category = 'all';
                      }),
                      child: const Text('Reset'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.pop(sheetContext, true),
                        child: const Text('Show campaigns'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (apply != true || !mounted) return;
    setState(() {
      _difficultyFilter = difficulty;
      _categoryFilter = category;
    });
  }

  Future<void> _findPrivateCampaign({String initialCode = ''}) async {
    final controller = TextEditingController(text: initialCode);
    final code = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Find private campaign'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 7,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Invite code',
            hintText: '#A1B2C3',
            prefixIcon: Icon(Icons.tag_rounded),
          ),
          onSubmitted: (value) => Navigator.pop(dialogContext, value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: const Text('Search'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (code == null || code.trim().isEmpty || !mounted) return;

    try {
      final campaign = await ApiService.getPrivateCampaignByCode(code);
      if (!mounted) return;
      final title = (campaign['title'] ?? 'Private campaign').toString();
      final location = [campaign['placeName'], campaign['district']]
          .map((value) => (value ?? '').toString().trim())
          .where((value) => value.isNotEmpty)
          .join(', ');
      final shouldJoin = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(title),
          content: Text(
            '${location.isEmpty ? 'Location to be confirmed' : location}\n\n'
            '${_genderAudienceLabel((campaign['genderVisibility'] ?? 'all').toString())} • Private campaign',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.pop(dialogContext, true),
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('Join'),
            ),
          ],
        ),
      );
      if (shouldJoin == true && mounted) {
        await _joinCampaign(
          _idOf(campaign),
          code: (campaign['campaignCode'] ?? code).toString(),
        );
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiService.readableError(error))),
      );
    }
  }

  Future<void> _joinCampaign(String campaignId, {String? code}) async {
    if (campaignId.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _campaignsProvider.joinCampaign(campaignId, code: code);
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

class _CampaignSearchBar extends StatelessWidget {
  const _CampaignSearchBar({
    required this.controller,
    required this.activeFilterCount,
    required this.onChanged,
    required this.onSubmitted,
    required this.onFilterTap,
  });

  final TextEditingController controller;
  final int activeFilterCount;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onFilterTap;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search destination or campaign',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: controller.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          controller.clear();
                          onChanged('');
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
                filled: true,
                fillColor: Colors.white,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
              ),
            ),
          ),
          const SizedBox(width: 9),
          Badge(
            isLabelVisible: activeFilterCount > 0,
            label: Text('$activeFilterCount'),
            child: IconButton.filledTonal(
              tooltip: 'Filter campaigns',
              onPressed: onFilterTap,
              icon: const Icon(Icons.tune_rounded),
              style: IconButton.styleFrom(
                minimumSize: const Size(52, 52),
                backgroundColor: Colors.white,
                foregroundColor: AppColors.navy,
                side: const BorderSide(color: AppColors.line),
              ),
            ),
          ),
        ],
      );
}

class _ActiveCampaignFilters extends StatelessWidget {
  const _ActiveCampaignFilters({
    required this.difficulty,
    required this.category,
    required this.onClearDifficulty,
    required this.onClearCategory,
  });

  final String difficulty;
  final String category;
  final VoidCallback onClearDifficulty;
  final VoidCallback onClearCategory;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 7,
        runSpacing: 7,
        children: [
          if (difficulty != 'all')
            InputChip(
              label: Text(_campaignLabel(difficulty)),
              onDeleted: onClearDifficulty,
            ),
          if (category != 'all')
            InputChip(
              label: Text(_campaignLabel(category)),
              onDeleted: onClearCategory,
            ),
        ],
      );
}

class _FilterChoices extends StatelessWidget {
  const _FilterChoices({
    required this.label,
    required this.value,
    required this.choices,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> choices;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.navy, fontWeight: FontWeight.w800)),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: choices.entries
                .map(
                  (choice) => ChoiceChip(
                    label: Text(choice.value),
                    selected: value == choice.key,
                    onSelected: (_) => onChanged(choice.key),
                  ),
                )
                .toList(growable: false),
          ),
        ],
      );
}

class _NoCampaignMatches extends StatelessWidget {
  const _NoCampaignMatches({required this.onClear});
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
        child: Column(
          children: [
            const Icon(Icons.search_off_rounded,
                size: 48, color: AppColors.muted),
            const SizedBox(height: 14),
            const Text(
              'No matching campaigns',
              style: TextStyle(
                color: AppColors.navy,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Try a different destination or remove some filters.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onClear,
              child: const Text('Clear search and filters'),
            ),
          ],
        ),
      );
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
                    _CampaignTag(
                      icon: Icons.people_outline_rounded,
                      label: _genderAudienceLabel(
                        (campaign['genderVisibility'] ?? 'all').toString(),
                      ),
                    ),
                    _CampaignTag(
                      icon: campaign['visibility'] == 'private'
                          ? Icons.lock_outline_rounded
                          : Icons.public_rounded,
                      label: campaign['visibility'] == 'private'
                          ? 'Private'
                          : 'Public',
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

String _genderAudienceLabel(String value) => switch (value) {
      'male' => 'Men only',
      'female' => 'Women only',
      _ => 'All genders',
    };

String _campaignLabel(String value) => value
    .trim()
    .toLowerCase()
    .split(RegExp(r'[_\s]+'))
    .where((part) => part.isNotEmpty)
    .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
