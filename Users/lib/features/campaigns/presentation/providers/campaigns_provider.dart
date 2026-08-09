import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';

class CampaignsProvider extends ChangeNotifier {
  static const _createdCampaignIdsKey = 'created_campaign_ids';
  List<dynamic> _campaigns = [];
  final List<Map<String, dynamic>> _createdCampaigns = [];
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  final int _pageSize = 20;
  int _totalCampaigns = 0;

  List<dynamic> get campaigns => _campaigns;
  bool get loading => _loading;
  String? get error => _error;
  int get currentPage => _currentPage;
  int get pageSize => _pageSize;
  int get totalCampaigns => _totalCampaigns;
  int get totalPages => (_totalCampaigns / _pageSize).ceil();

  Future<void> loadCampaigns({
    int page = 1,
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
        _loadCreatedCampaigns(),
      ]);
      final result = results[0] as Map<String, dynamic>;
      final savedCampaigns = results[1] as List<Map<String, dynamic>>;
      for (final saved in savedCampaigns.reversed) {
        final savedId = (saved['_id'] ?? saved['id']).toString();
        _createdCampaigns.removeWhere(
          (item) => (item['_id'] ?? item['id']).toString() == savedId,
        );
        _createdCampaigns.insert(0, saved);
      }

      final remote =
          (result['items'] ?? result['data']) as List<dynamic>? ?? [];
      final remoteIds = remote
          .whereType<Map>()
          .map((item) => (item['_id'] ?? item['id'] ?? '').toString())
          .toSet();
      _campaigns = [
        ..._createdCampaigns.where(
          (item) => !remoteIds.contains((item['_id'] ?? item['id']).toString()),
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
      _campaigns.insert(0, created);
      _totalCampaigns += 1;
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

  Future<List<Map<String, dynamic>>> _loadCreatedCampaigns() async {
    final preferences = await SharedPreferences.getInstance();
    final ids = preferences.getStringList(_createdCampaignIdsKey) ?? const [];
    final campaigns = <Map<String, dynamic>>[];
    final validIds = <String>[];
    for (final id in ids.take(20)) {
      try {
        final campaign = await ApiService.getCampaignDetails(id);
        campaigns.add({...campaign, '_createdByCurrentUser': true});
        validIds.add(id);
      } catch (_) {}
    }
    if (validIds.length != ids.length) {
      await preferences.setStringList(_createdCampaignIdsKey, validIds);
    }
    return campaigns;
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

  Future<void> joinCampaign(String campaignId) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.joinCampaign(campaignId);
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
