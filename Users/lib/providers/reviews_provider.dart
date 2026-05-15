import 'package:flutter/material.dart';
import '../services/api.dart';

class ReviewsProvider extends ChangeNotifier {
  List<dynamic> _reviews = [];
  bool _loading = false;
  String? _error;
  int _currentPage = 1;
  int _pageSize = 20;
  int _totalReviews = 0;

  List<dynamic> get reviews => _reviews;
  bool get loading => _loading;
  String? get error => _error;
  int get currentPage => _currentPage;
  int get pageSize => _pageSize;
  int get totalReviews => _totalReviews;
  int get totalPages => (_totalReviews / _pageSize).ceil();

  Future<void> loadReviews({
    int page = 1,
    String? targetType,
    String? targetId,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await ApiService.listReviews(
        page: page,
        limit: _pageSize,
        targetType: targetType,
        targetId: targetId,
      );

      _reviews = result['data'] as List<dynamic>? ?? [];
      _totalReviews = result['total'] as int? ?? 0;
      _currentPage = page;
      _error = null;
    } catch (e) {
      _error = e.toString();
      _reviews = [];
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> createReview(Map<String, dynamic> reviewData) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.createReview(reviewData);
      // Reload reviews list
      await loadReviews(page: 1);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateReview(
      String reviewId, Map<String, dynamic> updates) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.updateReview(reviewId, updates);
      // Reload reviews
      await loadReviews(page: _currentPage);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> deleteReview(String reviewId) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.deleteReview(reviewId);
      // Remove from list
      _reviews.removeWhere((review) => review['_id'] == reviewId);
      _totalReviews = (_totalReviews - 1).clamp(0, _totalReviews);
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  void nextPage() {
    if (_currentPage < totalPages) {
      loadReviews(page: _currentPage + 1);
    }
  }

  void previousPage() {
    if (_currentPage > 1) {
      loadReviews(page: _currentPage - 1);
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
