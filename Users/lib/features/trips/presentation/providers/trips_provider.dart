import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';

class TripsProvider extends ChangeNotifier {
  List<dynamic> _trips = [];
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  final int _pageSize = 20;
  int _totalTrips = 0;
  Future<void>? _loadInFlight;
  bool _hasLoaded = false;

  List<dynamic> get trips => _trips;
  bool get loading => _loading;
  String? get error => _error;
  int get currentPage => _currentPage;
  int get pageSize => _pageSize;
  int get totalTrips => _totalTrips;
  int get totalPages => (_totalTrips / _pageSize).ceil();
  bool get hasLoaded => _hasLoaded;

  Future<void> loadTrips({
    int page = 1,
    String? status,
    String? activityType,
    String? difficulty,
    String? province,
    String? district,
    double? lat,
    double? lng,
    int? maxDistance,
  }) async {
    final activeLoad = _loadInFlight;
    if (activeLoad != null) return activeLoad;

    final load = _performLoadTrips(
      page: page,
      status: status,
      activityType: activityType,
      difficulty: difficulty,
      province: province,
      district: district,
      lat: lat,
      lng: lng,
      maxDistance: maxDistance,
    );
    _loadInFlight = load;
    try {
      await load;
    } finally {
      _hasLoaded = true;
      if (identical(_loadInFlight, load)) _loadInFlight = null;
    }
  }

  Future<void> _performLoadTrips({
    required int page,
    String? status,
    String? activityType,
    String? difficulty,
    String? province,
    String? district,
    double? lat,
    double? lng,
    int? maxDistance,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await ApiService.listTrips(
        page: page,
        limit: _pageSize,
        status: status,
        activityType: activityType,
        difficulty: difficulty,
        province: province,
        district: district,
        lat: lat,
        lng: lng,
        maxDistance: maxDistance,
      );

      _trips = result['data'] as List<dynamic>? ?? [];
      _totalTrips = result['total'] as int? ?? 0;
      _currentPage = page;
      _error = null;
    } catch (e) {
      _error = e.toString();
      _trips = [];
    }

    _loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> getTripDetails(String tripId) async {
    try {
      return await ApiService.getTripDetails(tripId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> createTrip(Map<String, dynamic> tripData) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.createTrip(tripData);
      // Reload trips list
      await loadTrips(page: 1);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateTrip(String tripId, Map<String, dynamic> updates) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.updateTrip(tripId, updates);
      // Reload trip details
      await loadTrips(page: _currentPage);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> deleteTrip(String tripId) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.deleteTrip(tripId);
      // Remove from list
      _trips.removeWhere((trip) => trip['_id'] == tripId);
      _totalTrips = (_totalTrips - 1).clamp(0, _totalTrips);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> joinTrip(String tripId) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.joinTrip(tripId);
      // Reload trips to update participant count
      await loadTrips(page: _currentPage);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> checkinToTrip(String tripId,
      {double? latitude, double? longitude}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.checkinToTrip(tripId,
          latitude: latitude, longitude: longitude);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  void nextPage() {
    if (_currentPage < totalPages) {
      loadTrips(page: _currentPage + 1);
    }
  }

  void previousPage() {
    if (_currentPage > 1) {
      loadTrips(page: _currentPage - 1);
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
