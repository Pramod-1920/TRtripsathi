import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/features/campaigns/domain/campaign_lifecycle.dart';

class CampaignsProvider extends ChangeNotifier {
  static const _createdCampaignIdsKey = 'created_campaign_ids';
  List<dynamic> _campaigns = [];
  final List<Map<String, dynamic>> _createdCampaigns = [];
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  final int _pageSize = 20;
  int _totalCampaigns = 0;
  Future<void>? _loadInFlight;
  bool _hasLoaded = false;

  List<dynamic> get campaigns => _campaigns;
  List<Map<String, dynamic>> get createdCampaigns =>
      List.unmodifiable(_createdCampaigns);
  List<Map<String, dynamic>> get openCreatedCampaigns => _createdCampaigns
      .where((item) => campaignJourneyState(item) == CampaignJourneyState.open)
      .toList(growable: false);
  List<Map<String, dynamic>> get ongoingCreatedCampaigns => _createdCampaigns
      .where(
          (item) => campaignJourneyState(item) == CampaignJourneyState.ongoing)
      .toList(growable: false);
  List<Map<String, dynamic>> get expiredCreatedCampaigns => _createdCampaigns
      .where(
          (item) => campaignJourneyState(item) == CampaignJourneyState.expired)
      .toList(growable: false);
  bool get loading => _loading;
  String? get error => _error;
  int get currentPage => _currentPage;
  int get pageSize => _pageSize;
  int get totalCampaigns => _totalCampaigns;
  int get totalPages => (_totalCampaigns / _pageSize).ceil();
  bool get hasLoaded => _hasLoaded;

  Future<void> loadCampaigns({
    int page = 1,
    String? status,
  }) async {
    // The Trips and Campaigns tabs share this provider and can be opened in
    // quick succession. Reuse an active request instead of sending the same
    // campaign requests twice.
    final activeLoad = _loadInFlight;
    if (activeLoad != null) return activeLoad;

    final load = _performLoadCampaigns(page: page, status: status);
    _loadInFlight = load;
    try {
      await load;
    } finally {
      _hasLoaded = true;
      if (identical(_loadInFlight, load)) _loadInFlight = null;
    }
  }

  Future<void> _performLoadCampaigns({
    required int page,
    String? status,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        ApiService.listCampaigns(
          page: page,
          limit: _pageSize,
          status: status,
        ),
        _loadMyCampaignsSafely(),
      ]);
      final result = results[0];
      final mineResponse = results[1];
      final mine =
          (mineResponse['items'] ?? mineResponse['data']) as List? ?? const [];
      final mineEndpointUnavailable =
          mineResponse['_legacyUnavailable'] == true;
      // Saved campaign IDs are only a compatibility fallback for older
      // servers. Avoid fetching every saved campaign when /campaigns/mine is
      // available, which removes up to 20 unnecessary network round trips.
      final savedCampaigns = mineEndpointUnavailable
          ? await _loadCreatedCampaigns()
          : const <Map<String, dynamic>>[];
      final ownedCampaigns = mineEndpointUnavailable
          ? savedCampaigns
          : mine
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false);
      if (!mineEndpointUnavailable) _createdCampaigns.clear();
      for (final saved in ownedCampaigns.reversed) {
        final savedId = (saved['_id'] ?? saved['id']).toString();
        _createdCampaigns.removeWhere(
          (item) => (item['_id'] ?? item['id']).toString() == savedId,
        );
        _createdCampaigns.insert(
          0,
          {...saved, '_createdByCurrentUser': true},
        );
      }

      final remote =
          ((result['items'] ?? result['data']) as List<dynamic>? ?? [])
              .where(
                (item) =>
                    item is Map &&
                    item['hikeType'] == 'group' &&
                    campaignJourneyState(Map<String, dynamic>.from(item)) !=
                        CampaignJourneyState.expired,
              )
              .toList(growable: false);
      final remoteIds = remote
          .whereType<Map>()
          .map((item) => (item['_id'] ?? item['id'] ?? '').toString())
          .toSet();
      _campaigns = [
        ..._createdCampaigns.where(
          (item) =>
              item['hikeType'] == 'group' &&
              campaignJourneyState(item) != CampaignJourneyState.expired &&
              !remoteIds.contains((item['_id'] ?? item['id']).toString()),
        ),
        ...remote,
      ];
      final pagination = result['pagination'];
      _totalCampaigns = pagination is Map
          ? (pagination['total'] as num?)?.toInt() ?? _campaigns.length
          : (result['total'] as num?)?.toInt() ?? _campaigns.length;
      _currentPage = page;
      _error = null;
    } catch (e) {
      _error = ApiService.readableError(e);
      _campaigns = [..._createdCampaigns];
    }

    _loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> _loadMyCampaignsSafely() async {
    try {
      return await ApiService.listMyCampaigns();
    } catch (_) {
      // Ownership history is supplementary. Public campaigns and locally
      // remembered trips must remain usable if an older server does not yet
      // expose /campaigns/mine or authentication is temporarily unavailable.
      return {'items': <dynamic>[], '_legacyUnavailable': true};
    }
  }

  Future<Map<String, dynamic>> createCampaign(
    Map<String, dynamic> campaignData,
  ) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await ApiService.createCampaign(campaignData);
      final created = <String, dynamic>{
        ...response,
        '_createdByCurrentUser': true,
      };
      _createdCampaigns.removeWhere(
        (item) =>
            (item['_id'] ?? item['id']).toString() ==
            (created['_id'] ?? created['id']).toString(),
      );
      _createdCampaigns.insert(0, created);
      _campaigns.removeWhere(
        (item) =>
            item is Map &&
            (item['_id'] ?? item['id']).toString() ==
                (created['_id'] ?? created['id']).toString(),
      );
      if (created['hikeType'] == 'group') {
        _campaigns.insert(0, created);
        _totalCampaigns += 1;
      }
      await _rememberCreatedCampaign(created);
      return created;
    } catch (error) {
      _error = ApiService.readableError(error);
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> updateOwnedCampaign(
    String campaignId,
    Map<String, dynamic> campaignData,
  ) async {
    final response = await ApiService.updateCampaign(campaignId, campaignData);
    final updated = <String, dynamic>{
      ...response,
      '_createdByCurrentUser': true,
    };
    _replaceCampaign(_createdCampaigns, campaignId, updated);
    _campaigns.removeWhere(
      (item) =>
          item is Map && (item['_id'] ?? item['id']).toString() == campaignId,
    );
    if (updated['hikeType'] == 'group') _campaigns.insert(0, updated);
    await _rememberCreatedCampaign(updated);
    notifyListeners();
    return updated;
  }

  Future<void> deleteOwnedCampaign(String campaignId) async {
    await ApiService.deleteCampaign(campaignId);
    _createdCampaigns.removeWhere(
      (item) => (item['_id'] ?? item['id']).toString() == campaignId,
    );
    _campaigns.removeWhere(
      (item) =>
          item is Map && (item['_id'] ?? item['id']).toString() == campaignId,
    );
    final preferences = await SharedPreferences.getInstance();
    final ids = preferences.getStringList(_createdCampaignIdsKey) ?? const [];
    await preferences.setStringList(
      _createdCampaignIdsKey,
      ids.where((id) => id != campaignId).toList(growable: false),
    );
    notifyListeners();
  }

  Future<Map<String, dynamic>> verifyOwnedCampaign(
    String campaignId,
    Map<String, String> evidence,
  ) async {
    final response =
        await ApiService.verifyCampaignCompletion(campaignId, evidence);
    final verified = <String, dynamic>{
      ...response,
      '_createdByCurrentUser': true,
    };
    _replaceCampaign(_createdCampaigns, campaignId, verified);
    final publicIndex = _campaigns.indexWhere(
      (item) =>
          item is Map && (item['_id'] ?? item['id']).toString() == campaignId,
    );
    if (publicIndex >= 0) _campaigns[publicIndex] = verified;
    await _rememberCreatedCampaign(verified);
    notifyListeners();
    return verified;
  }

  Future<Map<String, dynamic>> decideMinimumParticipants(
    String campaignId,
    String decision,
  ) async {
    final response =
        await ApiService.decideMinimumParticipants(campaignId, decision);
    final updated = <String, dynamic>{
      ...response,
      '_createdByCurrentUser': true,
    };
    _replaceCampaign(_createdCampaigns, campaignId, updated);
    final publicIndex = _campaigns.indexWhere(
      (item) =>
          item is Map && (item['_id'] ?? item['id']).toString() == campaignId,
    );
    if (publicIndex >= 0) _campaigns[publicIndex] = updated;
    await _rememberCreatedCampaign(updated);
    notifyListeners();
    return updated;
  }

  void _replaceCampaign(
    List<Map<String, dynamic>> campaigns,
    String campaignId,
    Map<String, dynamic> updated,
  ) {
    final index = campaigns.indexWhere(
      (item) => (item['_id'] ?? item['id']).toString() == campaignId,
    );
    if (index == -1) {
      campaigns.insert(0, updated);
    } else {
      campaigns[index] = updated;
    }
  }

  Future<List<Map<String, dynamic>>> _loadCreatedCampaigns() async {
    final preferences = await SharedPreferences.getInstance();
    final ids = preferences.getStringList(_createdCampaignIdsKey) ?? const [];
    final campaigns = await Future.wait(
      ids.take(20).map((id) async {
        try {
          final campaign = await ApiService.getCampaignDetails(id);
          return <String, dynamic>{
            ...campaign,
            '_createdByCurrentUser': true,
          };
        } catch (_) {
          return null;
        }
      }),
    );
    return campaigns.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  Future<void> _rememberCreatedCampaign(Map<String, dynamic> campaign) async {
    final id = (campaign['_id'] ?? campaign['id'] ?? '').toString();
    if (id.isEmpty) return;
    final preferences = await SharedPreferences.getInstance();
    final ids = preferences.getStringList(_createdCampaignIdsKey) ?? <String>[];
    await preferences.setStringList(
      _createdCampaignIdsKey,
      [id, ...ids.where((item) => item != id)].take(20).toList(),
    );
  }

  Future<Map<String, dynamic>> getCampaignDetails(String campaignId) async {
    try {
      return await ApiService.getCampaignDetails(campaignId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> joinCampaign(String campaignId, {String? code}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.joinCampaign(campaignId, code: code);
      // Reload campaigns to update participant count
      await loadCampaigns(page: _currentPage);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  void nextPage() {
    if (_currentPage < totalPages) {
      loadCampaigns(page: _currentPage + 1);
    }
  }

  void previousPage() {
    if (_currentPage > 1) {
      loadCampaigns(page: _currentPage - 1);
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
