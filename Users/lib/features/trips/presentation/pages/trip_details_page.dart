import 'package:flutter/material.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/domain/campaign_lifecycle.dart';

class TripDetailsScreen extends StatefulWidget {
  const TripDetailsScreen({
    super.key,
    required this.initialTrip,
    this.isCampaign = false,
  });

  final Map<String, dynamic> initialTrip;
  final bool isCampaign;

  @override
  State<TripDetailsScreen> createState() => _TripDetailsScreenState();
}

class _TripDetailsScreenState extends State<TripDetailsScreen> {
  late Map<String, dynamic> _trip;
  bool _refreshing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _trip = {...widget.initialTrip};
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    final id = (_trip['_id'] ?? _trip['id'] ?? '').toString();
    if (id.isEmpty) return;
    setState(() {
      _refreshing = true;
      _error = null;
    });
    try {
      final details = widget.isCampaign
          ? await ApiService.getCampaignDetails(id)
          : await ApiService.getTripDetails(id);
      if (!mounted) return;
      setState(() => _trip = {..._trip, ...details});
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _text('title', fallback: 'Untitled trip');
    final description = _text('description');
    final location = [_text('placeName'), _text('district'), _text('province')]
        .where((part) => part.isNotEmpty)
        .toSet()
        .join(', ');
    final photoUrl = _firstPhotoUrl();
    final status = widget.isCampaign
        ? campaignStatusLabel(_trip)
        : _label(
            _text(
              'lifecyclePhase',
              fallback: _text('status', fallback: 'planned'),
            ),
          );

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F5),
      body: RefreshIndicator(
        color: AppColors.gold,
        backgroundColor: AppColors.navy,
        onRefresh: _loadDetails,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              stretch: true,
              expandedHeight: 330,
              elevation: 0,
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              title: Text(
                widget.isCampaign ? 'Campaign details' : 'Trip details',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.parallax,
                stretchModes: const [StretchMode.zoomBackground],
                background: _TripHero(
                  photoUrl: photoUrl,
                  title: title,
                  location: location,
                  status: status,
                ),
              ),
            ),
            if (_refreshing)
              const SliverToBoxAdapter(
                child: LinearProgressIndicator(
                  minHeight: 2,
                  color: AppColors.gold,
                  backgroundColor: Colors.transparent,
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 38),
              sliver: SliverList.list(
                children: [
                  if (_error != null) ...[
                    _ErrorNotice(message: _error!, onRetry: _loadDetails),
                    const SizedBox(height: 16),
                  ],
                  const _SectionHeading(eyebrow: '', title: 'Trip overview'),
                  const SizedBox(height: 12),
                  _DetailsGrid(items: _detailItems()),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const _SectionHeading(
                      eyebrow: '',
                      title: 'About this trip',
                    ),
                    const SizedBox(height: 12),
                    _SectionCard(
                      child: Text(
                        description,
                        style: const TextStyle(
                          height: 1.65,
                          fontSize: 14,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                  ],
                  if (_text('campaignCode').isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const _SectionHeading(
                      eyebrow: '',
                      title: 'Private invitation',
                    ),
                    const SizedBox(height: 12),
                    _InviteCode(code: _text('campaignCode')),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<_DetailItem> _detailItems() {
    final participants =
        _number('currentParticipantCount') ?? _listLength('participants') ?? 1;
    final maxParticipants = _number('maxParticipants');
    return [
      _DetailItem(
          Icons.calendar_month_outlined, 'Starts', _date(_trip['startDate'])),
      _DetailItem(
          Icons.event_available_outlined, 'Ends', _date(_trip['endDate'])),
      _DetailItem(Icons.route_outlined, 'Type',
          _label(_text('hikeType', fallback: _text('activityType')))),
      _DetailItem(
          Icons.terrain_outlined, 'Difficulty', _label(_text('difficulty'))),
      _DetailItem(
        Icons.groups_outlined,
        'Travelers',
        maxParticipants == null
            ? '$participants'
            : '$participants / $maxParticipants',
      ),
      _DetailItem(Icons.lock_outline_rounded, 'Visibility',
          _label(_text('visibility', fallback: 'public'))),
      if (_text('genderVisibility').isNotEmpty)
        _DetailItem(Icons.people_outline_rounded, 'Who can join',
            _genderLabel(_text('genderVisibility'))),
      if (_trip['estimatedNPR'] != null)
        _DetailItem(Icons.payments_outlined, 'Estimated cost',
            'NPR ${_trip['estimatedNPR']}'),
    ].where((item) => item.value.isNotEmpty).toList();
  }

  String _text(String key, {String fallback = ''}) {
    final value = (_trip[key] ?? '').toString().trim();
    return value.isEmpty ? fallback : value;
  }

  num? _number(String key) => _trip[key] is num ? _trip[key] as num : null;

  int? _listLength(String key) =>
      _trip[key] is List ? (_trip[key] as List).length : null;

  String _firstPhotoUrl() {
    for (final key in ['coverImage', 'coverImageUrl', 'imageUrl', 'photoUrl']) {
      final value = _text(key);
      if (value.isNotEmpty) {
        return ApiService.autoOrientCloudinaryImage(value);
      }
    }
    final photos = _trip['photos'];
    if (photos is List && photos.isNotEmpty) {
      final first = photos.first;
      if (first is Map) {
        return ApiService.autoOrientCloudinaryImage(
          (first['url'] ?? '').toString(),
        );
      }
      return ApiService.autoOrientCloudinaryImage(first.toString());
    }
    return '';
  }
}

class _TripHero extends StatelessWidget {
  const _TripHero({
    required this.photoUrl,
    required this.title,
    required this.location,
    required this.status,
  });

  final String photoUrl;
  final String title;
  final String location;
  final String status;

  @override
  Widget build(BuildContext context) => Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: Color(0xFF17324D)),
          if (photoUrl.isEmpty)
            const _HeroFallback()
          else
            Image.network(
              photoUrl,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const _HeroFallback(),
            ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x550B2522),
                  Color(0x110B2522),
                  Color(0xE60B2522),
                ],
                stops: [0, .43, 1],
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _StatusChip(label: status, dark: true),
                const SizedBox(height: 10),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 29,
                    height: 1.08,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -.4,
                  ),
                ),
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded,
                          size: 18, color: AppColors.gold),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          location,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      );
}

class _HeroFallback extends StatelessWidget {
  const _HeroFallback();

  @override
  Widget build(BuildContext context) => Container(
        color: const Color(0xFF234E46),
        child: const Center(
          child:
              Icon(Icons.landscape_outlined, size: 64, color: Colors.white54),
        ),
      );
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.eyebrow, required this.title});
  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) => Semantics(
        header: true,
        label: eyebrow.isEmpty ? title : '$eyebrow, $title',
        child: ExcludeSemantics(
          child: Text(
            title,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      );
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: child,
      );
}

class _DetailsGrid extends StatelessWidget {
  const _DetailsGrid({required this.items});
  final List<_DetailItem> items;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            for (var index = 0; index < items.length; index++) ...[
              _DetailRow(item: items[index]),
              if (index != items.length - 1)
                const Divider(height: 1, indent: 64, endIndent: 16),
            ],
          ],
        ),
      );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.item});
  final _DetailItem item;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F3EF),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(item.icon, color: AppColors.navy, size: 19),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                item.label,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Text(
                item.value,
                textAlign: TextAlign.right,
                style: const TextStyle(
                  color: AppColors.navy,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      );
}

class _DetailItem {
  const _DetailItem(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, this.dark = false});
  final String label;
  final bool dark;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: dark ? AppColors.gold : const Color(0xFFFFF5D9),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(label.toUpperCase(),
            style: const TextStyle(
                color: AppColors.navy,
                fontSize: 10,
                fontWeight: FontWeight.w900)),
      );
}

class _InviteCode extends StatelessWidget {
  const _InviteCode({required this.code});
  final String code;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF5D9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.key_outlined, color: AppColors.navy),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child:
                  Text('Invite code', style: TextStyle(color: AppColors.muted)),
            ),
            Text(code,
                style: const TextStyle(
                    color: AppColors.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2)),
          ],
        ),
      );
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Expanded(child: Text(message, maxLines: 2)),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

String _date(dynamic value) {
  final date = DateTime.tryParse((value ?? '').toString())?.toLocal();
  if (date == null) return '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}

String _label(String value) {
  if (value.isEmpty) return '';
  final words = value.replaceAll('_', ' ').split(' ');
  return words
      .where((word) => word.isNotEmpty)
      .map((word) => '${word[0].toUpperCase()}${word.substring(1)}')
      .join(' ');
}

String _genderLabel(String value) => switch (value.toLowerCase()) {
      'male' => 'Boys only',
      'female' => 'Girls only',
      _ => 'All genders',
    };
