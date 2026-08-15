import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_boundary.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trip_details_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

enum _MapFilter { all, campaigns, trips }

class TripMapScreen extends StatefulWidget {
  const TripMapScreen({super.key});

  @override
  State<TripMapScreen> createState() => _TripMapScreenState();
}

class _TripMapScreenState extends State<TripMapScreen>
    with WidgetsBindingObserver {
  static const _nepalCenter = LatLng(28.3949, 84.1240);

  final MapController _mapController = MapController();
  _MapFilter _filter = _MapFilter.all;
  String? _selectedId;
  LatLng? _userLocation;
  bool _locating = false;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refresh();
      _restoreKnownLocation();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _mapController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final campaigns = context.read<CampaignsProvider>();
    final trips = context.read<TripsProvider>();
    await Future.wait([
      campaigns.loadCampaigns(),
      trips.loadTrips(),
    ]);
  }

  Future<void> _restoreKnownLocation() async {
    final permission = await Geolocator.checkPermission();
    if (permission != LocationPermission.always &&
        permission != LocationPermission.whileInUse) {
      return;
    }
    final position = await Geolocator.getLastKnownPosition();
    if (!mounted || position == null) return;
    setState(() {
      _userLocation = LatLng(position.latitude, position.longitude);
    });
  }

  Future<void> _locateUser() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _showMessage('Turn on location services to find your position.');
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Location permission is blocked. Enable it in app settings.',
            ),
            action: SnackBarAction(
              label: 'Settings',
              textColor: AppColors.gold,
              onPressed: Geolocator.openAppSettings,
            ),
          ),
        );
        return;
      }
      if (permission == LocationPermission.denied) {
        _showMessage('Location permission was not granted.');
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      if (!mounted) return;
      final point = LatLng(position.latitude, position.longitude);
      setState(() => _userLocation = point);
      if (_mapReady) _mapController.move(point, 13.5);
    } catch (error) {
      if (mounted) _showMessage(ApiService.readableError(error));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _select(_MapDestination item) {
    setState(() => _selectedId = item.id);
    if (_mapReady) _mapController.move(item.point, 13);
  }

  void _openDetails(_MapDestination item) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => TripDetailsScreen(
          initialTrip: item.data,
          isCampaign: item.isCampaign,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final campaigns = context.watch<CampaignsProvider>();
    final trips = context.watch<TripsProvider>();
    final allItems = _destinations(campaigns, trips);
    final visibleItems = allItems.where((item) {
      return switch (_filter) {
        _MapFilter.all => true,
        _MapFilter.campaigns => item.isCampaign,
        _MapFilter.trips => !item.isCampaign,
      };
    }).toList(growable: false);
    final selected = allItems.cast<_MapDestination?>().firstWhere(
          (item) => item?.id == _selectedId,
          orElse: () => null,
        );
    final loading = campaigns.loading || trips.loading;
    final error = campaigns.error ?? trips.error;

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Explore map'),
            Text(
              'Trips and campaign destinations',
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
            tooltip: 'Refresh map',
            onPressed: loading ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _nepalCenter,
              initialZoom: 6,
              minZoom: 6,
              maxZoom: 18,
              backgroundColor: AppColors.canvas,
              cameraConstraint: CameraConstraint.containCenter(
                bounds: nepalMapBounds,
              ),
              onMapReady: () => _mapReady = true,
              onTap: (_, __) {
                if (_selectedId != null) setState(() => _selectedId = null);
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.test.tripsathi',
                maxNativeZoom: 19,
                tileBounds: nepalMapBounds,
              ),
              PolygonLayer(
                invertedFill: AppColors.canvas,
                polygons: [
                  Polygon(
                    points: nepalBoundary,
                    color: Colors.transparent,
                    borderColor: AppColors.navy.withValues(alpha: .55),
                    borderStrokeWidth: 1.4,
                  ),
                ],
              ),
              MarkerLayer(
                markers: [
                  for (final item in visibleItems)
                    Marker(
                      point: item.point,
                      width: 52,
                      height: 52,
                      alignment: Alignment.topCenter,
                      child: Semantics(
                        button: true,
                        label: 'Open ${item.title}',
                        child: GestureDetector(
                          onTap: () => _select(item),
                          child: _DestinationMarker(
                            isCampaign: item.isCampaign,
                            selected: item.id == _selectedId,
                          ),
                        ),
                      ),
                    ),
                  if (_userLocation != null)
                    Marker(
                      point: _userLocation!,
                      width: 34,
                      height: 34,
                      child: const _UserLocationMarker(),
                    ),
                ],
              ),
              const RichAttributionWidget(
                attributions: [
                  TextSourceAttribution('OpenStreetMap contributors'),
                  TextSourceAttribution(
                    'Nepal boundary: geoBoundaries / Open Data Nepal',
                  ),
                ],
              ),
            ],
          ),
          if (loading)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(
                minHeight: 2,
                color: AppColors.goldDark,
              ),
            ),
          Positioned(
            left: 12,
            right: 12,
            top: 12,
            child: _FilterBar(
              value: _filter,
              resultCount: visibleItems.length,
              onChanged: (value) => setState(() {
                _filter = value;
                _selectedId = null;
              }),
            ),
          ),
          if (!loading && visibleItems.isEmpty)
            Positioned(
              left: 22,
              right: 22,
              top: 92,
              child: _EmptyMapNotice(
                message: error == null
                    ? 'No pinned active destinations yet. Create a trip and pin its destination to add it here.'
                    : ApiService.readableError(error),
                onRetry: _refresh,
              ),
            ),
          Positioned(
            right: 14,
            bottom: selected == null ? 30 : 204,
            child: FloatingActionButton.small(
              heroTag: 'map-location',
              tooltip: 'My location',
              backgroundColor: Colors.white,
              foregroundColor: AppColors.navy,
              onPressed: _locating ? null : _locateUser,
              child: _locating
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded),
            ),
          ),
          if (selected != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 28,
              child: _DestinationPreview(
                item: selected,
                onOpen: () => _openDetails(selected),
                onClose: () => setState(() => _selectedId = null),
              ),
            ),
        ],
      ),
    );
  }

  List<_MapDestination> _destinations(
    CampaignsProvider campaigns,
    TripsProvider trips,
  ) {
    final result = <_MapDestination>[];
    final ids = <String>{};
    for (final raw in campaigns.campaigns.whereType<Map>()) {
      final item = _MapDestination.fromJson(
        Map<String, dynamic>.from(raw),
        isCampaign: true,
      );
      if (item != null && ids.add(item.id)) result.add(item);
    }
    for (final raw in trips.trips.whereType<Map>()) {
      final data = Map<String, dynamic>.from(raw);
      final status = (data['status'] ?? '').toString().toLowerCase();
      if (status == 'draft' || status == 'cancelled' || status == 'completed') {
        continue;
      }
      final item = _MapDestination.fromJson(data, isCampaign: false);
      if (item != null && ids.add(item.id)) result.add(item);
    }
    return result;
  }
}

class _MapDestination {
  const _MapDestination({
    required this.id,
    required this.title,
    required this.location,
    required this.status,
    required this.date,
    required this.point,
    required this.isCampaign,
    required this.data,
  });

  final String id;
  final String title;
  final String location;
  final String status;
  final DateTime? date;
  final LatLng point;
  final bool isCampaign;
  final Map<String, dynamic> data;

  static _MapDestination? fromJson(
    Map<String, dynamic> data, {
    required bool isCampaign,
  }) {
    final gps = data['locationGps'];
    if (gps is! Map || gps['coordinates'] is! List) return null;
    final coordinates = gps['coordinates'] as List;
    if (coordinates.length < 2 ||
        coordinates[0] is! num ||
        coordinates[1] is! num) {
      return null;
    }
    final longitude = (coordinates[0] as num).toDouble();
    final latitude = (coordinates[1] as num).toDouble();
    if (longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90) {
      return null;
    }
    final id = (data['_id'] ?? data['id'] ?? '').toString();
    if (id.isEmpty) return null;
    final location = [
      data['placeName'],
      data['district'],
      data['province'],
    ]
        .map((value) => (value ?? '').toString().trim())
        .where((value) => value.isNotEmpty)
        .toSet()
        .join(', ');
    final status =
        (data['lifecyclePhase'] ?? data['status'] ?? 'planned').toString();
    return _MapDestination(
      id: id,
      title: (data['title'] ?? 'Untitled trip').toString(),
      location: location.isEmpty ? 'Pinned destination' : location,
      status: status,
      date: DateTime.tryParse((data['startDate'] ?? '').toString())?.toLocal(),
      point: LatLng(latitude, longitude),
      isCampaign: isCampaign,
      data: data,
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.value,
    required this.resultCount,
    required this.onChanged,
  });

  final _MapFilter value;
  final int resultCount;
  final ValueChanged<_MapFilter> onChanged;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 3,
        shadowColor: Colors.black26,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 7, 10, 7),
          child: Row(
            children: [
              for (final entry in const [
                (_MapFilter.all, 'All'),
                (_MapFilter.campaigns, 'Campaigns'),
                (_MapFilter.trips, 'Trips'),
              ]) ...[
                ChoiceChip(
                  label: Text(entry.$2),
                  selected: value == entry.$1,
                  visualDensity: VisualDensity.compact,
                  onSelected: (_) => onChanged(entry.$1),
                ),
                const SizedBox(width: 5),
              ],
              const Spacer(),
              Text(
                '$resultCount',
                style: const TextStyle(
                  color: AppColors.muted,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      );
}

class _DestinationMarker extends StatelessWidget {
  const _DestinationMarker({
    required this.isCampaign,
    required this.selected,
  });

  final bool isCampaign;
  final bool selected;

  @override
  Widget build(BuildContext context) => AnimatedScale(
        scale: selected ? 1.16 : 1,
        duration: const Duration(milliseconds: 160),
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Icon(
              Icons.location_pin,
              size: 50,
              color: isCampaign ? AppColors.navy : AppColors.goldDark,
              shadows: const [
                Shadow(
                    color: Colors.black38, blurRadius: 8, offset: Offset(0, 3)),
              ],
            ),
            Positioned(
              top: 10,
              child: Icon(
                isCampaign ? Icons.groups_rounded : Icons.hiking_rounded,
                size: 18,
                color: isCampaign ? AppColors.gold : AppColors.navy,
              ),
            ),
          ],
        ),
      );
}

class _UserLocationMarker extends StatelessWidget {
  const _UserLocationMarker();

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF2774E6).withValues(alpha: .2),
        ),
        padding: const EdgeInsets.all(7),
        child: Container(
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFF2774E6),
            border: Border.fromBorderSide(
              BorderSide(color: Colors.white, width: 2.5),
            ),
          ),
        ),
      );
}

class _EmptyMapNotice extends StatelessWidget {
  const _EmptyMapNotice({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 2,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.explore_outlined, color: AppColors.navy),
              const SizedBox(width: 11),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(color: AppColors.muted, height: 1.35),
                ),
              ),
              IconButton(
                tooltip: 'Try again',
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
        ),
      );
}

class _DestinationPreview extends StatelessWidget {
  const _DestinationPreview({
    required this.item,
    required this.onOpen,
    required this.onClose,
  });

  final _MapDestination item;
  final VoidCallback onOpen;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 8,
        shadowColor: Colors.black38,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(22),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: item.isCampaign
                        ? AppColors.navy
                        : AppColors.gold.withValues(alpha: .3),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(
                    item.isCampaign
                        ? Icons.groups_rounded
                        : Icons.hiking_rounded,
                    color: item.isCampaign ? AppColors.gold : AppColors.navy,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      const SizedBox(height: 7),
                      Wrap(
                        spacing: 6,
                        runSpacing: 5,
                        children: [
                          _PreviewTag(_readable(item.status)),
                          if (item.date != null)
                            _PreviewTag(_shortDate(item.date!)),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Close preview',
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
              ],
            ),
          ),
        ),
      );
}

class _PreviewTag extends StatelessWidget {
  const _PreviewTag(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.canvas,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: AppColors.navy,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
}

String _readable(String value) {
  final words = value.replaceAll('_', ' ').trim().split(RegExp(r'\s+'));
  return words
      .where((word) => word.isNotEmpty)
      .map((word) => '${word[0].toUpperCase()}${word.substring(1)}')
      .join(' ');
}

String _shortDate(DateTime date) {
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
  return '${months[date.month - 1]} ${date.day}';
}
