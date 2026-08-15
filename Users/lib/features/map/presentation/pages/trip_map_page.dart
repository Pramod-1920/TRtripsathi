import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/core/theme/app_theme.dart';
import 'package:trtripsathi_mobile/features/campaigns/presentation/providers/campaigns_provider.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_boundary.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_administrative_registry.dart';
import 'package:trtripsathi_mobile/features/map/domain/nepal_district_boundaries.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/pages/trip_details_page.dart';
import 'package:trtripsathi_mobile/features/trips/presentation/providers/trips_provider.dart';

enum _MapFilter { all, campaigns, trips }

enum _MapView { destinations, visits }

enum _CoverageLevel { provinces, districts }

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
  _MapView _mapView = _MapView.destinations;
  _CoverageLevel _coverageLevel = _CoverageLevel.provinces;
  String? _selectedId;
  DistrictBoundaryData? _selectedDistrict;
  _ApprovedPlace? _selectedPlace;
  Map<String, int> _visitCounts = const {};
  List<_ApprovedPlace> _approvedPlaces = const [];
  bool _visitsLoading = false;
  String? _visitsError;
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
      _loadVisits(),
    ]);
  }

  Future<void> _loadVisits() async {
    if (mounted) {
      setState(() {
        _visitsLoading = true;
        _visitsError = null;
      });
    }
    try {
      final response = await ApiService.getMyVisitedPlaces();
      final counts = <String, int>{};
      for (final raw in (response['items'] as List? ?? const [])) {
        if (raw is! Map) continue;
        final item = Map<String, dynamic>.from(raw);
        final type = (item['placeType'] ?? '').toString().toLowerCase();
        final key = _placeKey(item['placeCode']);
        if (key.isEmpty) continue;
        final count = (item['visitCount'] as num?)?.toInt() ?? 1;
        counts['$type:$key'] = count < 1 ? 1 : count;
      }
      final approvedPlaces = <_ApprovedPlace>[];
      for (final raw in (response['approvedPlaces'] as List? ?? const [])) {
        if (raw is! Map) continue;
        final place = _ApprovedPlace.fromJson(Map<String, dynamic>.from(raw));
        if (place != null) approvedPlaces.add(place);
      }
      if (mounted) {
        setState(() {
          _visitCounts = counts;
          _approvedPlaces = approvedPlaces;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _visitsError = ApiService.readableError(error));
      }
    } finally {
      if (mounted) setState(() => _visitsLoading = false);
    }
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

  void _selectCoverage(LatLng point) {
    DistrictBoundaryData? match;
    for (final district in nepalDistrictBoundaries) {
      if (_containsPoint(point, district.points)) {
        match = district;
        break;
      }
    }
    setState(() {
      _selectedDistrict = match;
      _selectedPlace = null;
      _selectedId = null;
    });
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
    final loading = campaigns.loading || trips.loading || _visitsLoading;
    final error = campaigns.error ?? trips.error;
    final districtVisitCounts = {
      for (final district in nepalDistrictBoundaries)
        district.name: _districtCount(district.name),
    };
    final provinceVisitCounts = <int, int>{};
    for (final province in provinceNames.keys) {
      final districts = nepalDistrictsByProvince[province] ?? const <String>{};
      final complete = districts.every(
        (district) => (districtVisitCounts[district] ?? 0) > 0,
      );
      provinceVisitCounts[province] = complete
          ? districts.fold(
              0,
              (total, district) => total + (districtVisitCounts[district] ?? 0),
            )
          : 0;
    }
    final maxCoverageCount = (_coverageLevel == _CoverageLevel.districts
            ? districtVisitCounts.values
            : provinceVisitCounts.values)
        .fold<int>(1, (maximum, value) => value > maximum ? value : maximum);
    final topDistrict = _highestEntry(districtVisitCounts);
    final topProvince = _highestEntry(provinceVisitCounts);
    final coverageLeader = _coverageLevel == _CoverageLevel.districts
        ? (topDistrict == null
            ? 'Complete a verified trip to begin your map'
            : 'Most visited: ${_readable(topDistrict.key)} (${topDistrict.value})')
        : (topProvince == null
            ? 'Complete every district in a province to turn it green'
            : 'Most visited: ${provinceNames[topProvince.key]} (${topProvince.value})');

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Nepal travel map'),
            Text(
              'Destinations and verified travel coverage',
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
              onTap: (_, point) {
                if (_mapView == _MapView.visits) {
                  _selectCoverage(point);
                } else if (_selectedId != null) {
                  setState(() => _selectedId = null);
                }
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
              if (_mapView == _MapView.visits)
                PolygonLayer(
                  polygons: [
                    for (final district in nepalDistrictBoundaries)
                      Polygon(
                        points: district.points,
                        color: _coverageColor(
                          _coverageLevel == _CoverageLevel.districts
                              ? districtVisitCounts[district.name] ?? 0
                              : provinceVisitCounts[district.province] ?? 0,
                          maxCoverageCount,
                        ),
                        borderColor: _coverageBorderColor(district),
                        borderStrokeWidth: _coverageBorderWidth(district),
                      ),
                  ],
                ),
              MarkerLayer(
                markers: [
                  if (_mapView == _MapView.destinations)
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
                  if (_mapView == _MapView.visits)
                    for (final place in _approvedPlaces)
                      Marker(
                        point: place.point,
                        width: 38,
                        height: 38,
                        alignment: Alignment.topCenter,
                        child: GestureDetector(
                          onTap: () => setState(() {
                            _selectedPlace = place;
                            _selectedDistrict = null;
                          }),
                          child: const _VerifiedPlaceMarker(),
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
                  TextSourceAttribution(
                    'District boundaries: Acesmndr/nepal-geojson',
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
            child: _MapViewBar(
              value: _mapView,
              onChanged: (value) => setState(() {
                _mapView = value;
                _selectedId = null;
                _selectedDistrict = null;
                _selectedPlace = null;
              }),
            ),
          ),
          if (_mapView == _MapView.destinations)
            Positioned(
              left: 12,
              right: 12,
              top: 70,
              child: _FilterBar(
                value: _filter,
                resultCount: visibleItems.length,
                onChanged: (value) => setState(() {
                  _filter = value;
                  _selectedId = null;
                }),
              ),
            ),
          if (_mapView == _MapView.visits)
            Positioned(
              left: 12,
              right: 12,
              top: 70,
              child: _CoverageSummary(
                level: _coverageLevel,
                districtCount:
                    districtVisitCounts.values.where((v) => v > 0).length,
                provinceCount:
                    provinceVisitCounts.values.where((v) => v > 0).length,
                totalVisits:
                    districtVisitCounts.values.fold(0, (a, b) => a + b),
                leader: coverageLeader,
                onChanged: (value) => setState(() {
                  _coverageLevel = value;
                  _selectedDistrict = null;
                  _selectedPlace = null;
                }),
              ),
            ),
          if (_mapView == _MapView.destinations &&
              !loading &&
              visibleItems.isEmpty)
            Positioned(
              left: 22,
              right: 22,
              top: 128,
              child: _EmptyMapNotice(
                message: error == null
                    ? 'No active trips right now. Pull to refresh or check again later.'
                    : ApiService.readableError(error),
                onRetry: _refresh,
              ),
            ),
          if (_mapView == _MapView.visits &&
              !_visitsLoading &&
              _visitsError != null)
            Positioned(
              left: 22,
              right: 22,
              top: 166,
              child:
                  _EmptyMapNotice(message: _visitsError!, onRetry: _loadVisits),
            ),
          Positioned(
            right: 14,
            bottom: (selected != null ||
                    _selectedDistrict != null ||
                    _selectedPlace != null)
                ? 204
                : 30,
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
          if (_mapView == _MapView.visits && _selectedDistrict != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 28,
              child: _CoveragePreview(
                district: _selectedDistrict!,
                level: _coverageLevel,
                districtCount:
                    districtVisitCounts[_selectedDistrict!.name] ?? 0,
                provinceCount:
                    provinceVisitCounts[_selectedDistrict!.province] ?? 0,
                visitedDistricts:
                    (nepalDistrictsByProvince[_selectedDistrict!.province] ??
                            const <String>{})
                        .where((district) =>
                            (districtVisitCounts[district] ?? 0) > 0)
                        .length,
                totalDistricts:
                    (nepalDistrictsByProvince[_selectedDistrict!.province] ??
                            const <String>{})
                        .length,
                onClose: () => setState(() => _selectedDistrict = null),
              ),
            ),
          if (_mapView == _MapView.visits && _selectedPlace != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 28,
              child: _ApprovedPlacePreview(
                place: _selectedPlace!,
                onClose: () => setState(() => _selectedPlace = null),
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
        fallbackPoint: _districtCenter(raw['district']),
      );
      if (item != null && ids.add(item.id)) result.add(item);
    }
    for (final raw in trips.trips.whereType<Map>()) {
      final data = Map<String, dynamic>.from(raw);
      final status = (data['status'] ?? '').toString().toLowerCase();
      if (status == 'draft' || status == 'cancelled' || status == 'completed') {
        continue;
      }
      final item = _MapDestination.fromJson(
        data,
        isCampaign: false,
        fallbackPoint: _districtCenter(data['district']),
      );
      if (item != null && ids.add(item.id)) result.add(item);
    }
    return result;
  }

  int _districtCount(String name) {
    for (final alias in nepalDistrictAliases(name)) {
      final count = _visitCounts['district:$alias'];
      if (count != null) return count;
    }
    return 0;
  }

  Color _coverageColor(int count, int maximum) => count == 0
      ? Colors.white.withValues(alpha: .08)
      : const Color(0xFF159455)
          .withValues(alpha: .24 + (.48 * count / maximum));

  Color _coverageBorderColor(DistrictBoundaryData district) {
    final selected = _selectedDistrict;
    final isSelected = selected != null &&
        (_coverageLevel == _CoverageLevel.districts
            ? selected.name == district.name
            : selected.province == district.province);
    return isSelected
        ? AppColors.goldDark
        : AppColors.navy.withValues(alpha: .42);
  }

  double _coverageBorderWidth(DistrictBoundaryData district) {
    final selected = _selectedDistrict;
    if (selected == null) return .7;
    return (_coverageLevel == _CoverageLevel.districts
            ? selected.name == district.name
            : selected.province == district.province)
        ? 2.1
        : .7;
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
    LatLng? fallbackPoint,
  }) {
    final gps = data['locationGps'];
    LatLng? point = fallbackPoint;
    if (gps is Map && gps['coordinates'] is List) {
      final coordinates = gps['coordinates'] as List;
      if (coordinates.length >= 2 &&
          coordinates[0] is num &&
          coordinates[1] is num) {
        final longitude = (coordinates[0] as num).toDouble();
        final latitude = (coordinates[1] as num).toDouble();
        if (longitude >= -180 &&
            longitude <= 180 &&
            latitude >= -90 &&
            latitude <= 90) {
          point = LatLng(latitude, longitude);
        }
      }
    }
    if (point == null) return null;
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
      point: point,
      isCampaign: isCampaign,
      data: data,
    );
  }
}

class _ApprovedPlace {
  const _ApprovedPlace({
    required this.id,
    required this.title,
    required this.place,
    required this.district,
    required this.municipality,
    required this.province,
    required this.address,
    required this.category,
    required this.photoUrl,
    required this.point,
  });

  final String id;
  final String title;
  final String place;
  final String district;
  final String municipality;
  final String province;
  final String address;
  final String category;
  final String photoUrl;
  final LatLng point;

  static _ApprovedPlace? fromJson(Map<String, dynamic> data) {
    final id = (data['requestCode'] ?? '').toString();
    final place = (data['place'] ?? '').toString().trim();
    final district = (data['district'] ?? '').toString().trim();
    if (id.isEmpty || place.isEmpty || district.isEmpty) return null;
    LatLng? point;
    if (data['latitude'] is num && data['longitude'] is num) {
      final candidate = LatLng(
        (data['latitude'] as num).toDouble(),
        (data['longitude'] as num).toDouble(),
      );
      if (isInsideNepal(candidate)) point = candidate;
    }
    point ??= _districtCenter(district);
    if (point == null) return null;
    return _ApprovedPlace(
      id: id,
      title: (data['title'] ?? place).toString(),
      place: place,
      district: district,
      municipality: (data['municipality'] ?? '').toString(),
      province: (data['province'] ?? '').toString(),
      address: (data['address'] ?? '').toString(),
      category: (data['category'] ?? '').toString(),
      photoUrl: (data['photoUrl'] ?? '').toString(),
      point: point,
    );
  }
}

class _MapViewBar extends StatelessWidget {
  const _MapViewBar({required this.value, required this.onChanged});

  final _MapView value;
  final ValueChanged<_MapView> onChanged;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 3,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Row(
            children: [
              for (final entry in const [
                (_MapView.destinations, Icons.location_pin, 'Destinations'),
                (_MapView.visits, Icons.map_outlined, 'My visits'),
              ])
                Expanded(
                  child: InkWell(
                    onTap: () => onChanged(entry.$1),
                    borderRadius: BorderRadius.circular(14),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: value == entry.$1
                            ? AppColors.navy
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(entry.$2,
                              size: 18,
                              color: value == entry.$1
                                  ? AppColors.gold
                                  : AppColors.muted),
                          const SizedBox(width: 7),
                          Text(entry.$3,
                              style: TextStyle(
                                color: value == entry.$1
                                    ? Colors.white
                                    : AppColors.ink,
                                fontWeight: FontWeight.w800,
                              )),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

class _CoverageSummary extends StatelessWidget {
  const _CoverageSummary({
    required this.level,
    required this.districtCount,
    required this.provinceCount,
    required this.totalVisits,
    required this.leader,
    required this.onChanged,
  });

  final _CoverageLevel level;
  final int districtCount;
  final int provinceCount;
  final int totalVisits;
  final String leader;
  final ValueChanged<_CoverageLevel> onChanged;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 3,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  for (final entry in const [
                    (_CoverageLevel.provinces, 'Provinces'),
                    (_CoverageLevel.districts, 'Districts'),
                  ]) ...[
                    ChoiceChip(
                      label: Text(entry.$2),
                      selected: level == entry.$1,
                      visualDensity: VisualDensity.compact,
                      onSelected: (_) => onChanged(entry.$1),
                    ),
                    const SizedBox(width: 6),
                  ],
                  const Spacer(),
                  const Icon(Icons.verified_rounded,
                      size: 17, color: Color(0xFF159455)),
                  const SizedBox(width: 4),
                  Text('$totalVisits visits',
                      style: const TextStyle(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w900,
                      )),
                ],
              ),
              const SizedBox(height: 5),
              Text(
                '$provinceCount of 7 provinces  •  $districtCount of 77 districts',
                style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 3),
              Text(
                leader,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF147A49),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      );
}

class _CoveragePreview extends StatelessWidget {
  const _CoveragePreview({
    required this.district,
    required this.level,
    required this.districtCount,
    required this.provinceCount,
    required this.visitedDistricts,
    required this.totalDistricts,
    required this.onClose,
  });

  final DistrictBoundaryData district;
  final _CoverageLevel level;
  final int districtCount;
  final int provinceCount;
  final int visitedDistricts;
  final int totalDistricts;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final province =
        provinceNames[district.province] ?? 'Province ${district.province}';
    final isDistrict = level == _CoverageLevel.districts;
    final count = isDistrict ? districtCount : provinceCount;
    return Material(
      color: Colors.white,
      elevation: 8,
      borderRadius: BorderRadius.circular(22),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 15, 8, 15),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: count > 0
                    ? const Color(0xFF159455).withValues(alpha: .14)
                    : AppColors.canvas,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(count > 0 ? Icons.check_rounded : Icons.map_outlined,
                  color: count > 0 ? const Color(0xFF159455) : AppColors.muted),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(isDistrict ? _readable(district.name) : province,
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 17,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(
                    isDistrict
                        ? '$province • ${count == 0 ? 'Not visited yet' : '$count verified ${count == 1 ? 'visit' : 'visits'}'}'
                        : '$visitedDistricts of $totalDistricts districts • ${visitedDistricts == totalDistricts ? 'Province complete' : 'Visit every district to complete'}',
                    style: const TextStyle(color: AppColors.muted, height: 1.3),
                  ),
                ],
              ),
            ),
            IconButton(
                onPressed: onClose,
                tooltip: 'Close',
                icon: const Icon(Icons.close_rounded)),
          ],
        ),
      ),
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

class _VerifiedPlaceMarker extends StatelessWidget {
  const _VerifiedPlaceMarker();

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: const Color(0xFF159455),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: const [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 7,
              offset: Offset(0, 3),
            ),
          ],
        ),
        child: const Icon(
          Icons.photo_camera_rounded,
          size: 18,
          color: Colors.white,
        ),
      );
}

class _ApprovedPlacePreview extends StatelessWidget {
  const _ApprovedPlacePreview({required this.place, required this.onClose});

  final _ApprovedPlace place;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        elevation: 8,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 10, 6, 10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: place.photoUrl.isEmpty
                    ? Container(
                        width: 64,
                        height: 64,
                        color: AppColors.canvas,
                        child: const Icon(Icons.photo_outlined),
                      )
                    : Image.network(
                        place.photoUrl,
                        width: 64,
                        height: 64,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 64,
                          height: 64,
                          color: AppColors.canvas,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      place.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.ink,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${place.place} • ${place.municipality.isEmpty ? place.district : place.municipality}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                    const SizedBox(height: 5),
                    const Row(
                      children: [
                        Icon(
                          Icons.verified_rounded,
                          size: 15,
                          color: Color(0xFF159455),
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Admin verified',
                          style: TextStyle(
                            color: Color(0xFF147A49),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onClose,
                tooltip: 'Close',
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
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

String _placeKey(Object? value) => (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
    .replaceAll(RegExp(r'^_+|_+$'), '');

LatLng? _districtCenter(Object? districtName) {
  final targetAliases = nepalDistrictAliases((districtName ?? '').toString());
  if (targetAliases.every((value) => value.isEmpty)) return null;
  for (final district in nepalDistrictBoundaries) {
    if (nepalDistrictAliases(district.name).any(targetAliases.contains)) {
      return district.center;
    }
  }
  return null;
}

bool _containsPoint(LatLng point, List<LatLng> polygon) {
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    final a = polygon[i];
    final b = polygon[j];
    final crosses =
        (a.latitude > point.latitude) != (b.latitude > point.latitude) &&
            point.longitude <
                (b.longitude - a.longitude) *
                        (point.latitude - a.latitude) /
                        (b.latitude - a.latitude) +
                    a.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

MapEntry<K, int>? _highestEntry<K>(Map<K, int> counts) {
  MapEntry<K, int>? result;
  for (final entry in counts.entries) {
    if (entry.value > 0 && (result == null || entry.value > result.value)) {
      result = entry;
    }
  }
  return result;
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
