import 'package:flutter/material.dart';
import '../services/api.dart';

class CampaignsProvider extends ChangeNotifier {
  List<dynamic> _campaigns = [];
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
      final result = await ApiService.listCampaigns(
        page: page,
        limit: _pageSize,
        status: status,
      );

      _campaigns = result['data'] as List<dynamic>? ?? [];
      _totalCampaigns = result['total'] as int? ?? 0;
      _currentPage = page;
      _error = null;
    } catch (e) {
      _error = e.toString();
      _campaigns = [];
    }

    _loading = false;
    notifyListeners();
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
