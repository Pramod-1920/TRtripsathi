import 'package:flutter/material.dart';
import '../services/api.dart';

class AchievementsProvider extends ChangeNotifier {
  List<dynamic> _achievements = [];
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _currentProfile;

  List<dynamic> get achievements => _achievements;
  bool get loading => _loading;
  String? get error => _error;
  Map<String, dynamic>? get currentProfile => _currentProfile;

  Future<void> loadAchievements() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _achievements = await ApiService.getAchievements();
      _error = null;
    } catch (e) {
      _error = e.toString();
      _achievements = [];
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> loadProfile() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      _currentProfile = await ApiService.getProfile();
      _error = null;
    } catch (e) {
      _error = e.toString();
      _currentProfile = null;
    }

    _loading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>> getXpHistory({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      return await ApiService.getXpHistory(page: page, limit: limit);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> triggerXpEvent(String eventKey,
      [Map<String, dynamic>? context]) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.triggerXpEvent(eventKey, context);
      // Reload profile to update XP
      await loadProfile();
      await loadAchievements();
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> triggerAchievementEvent(Map<String, dynamic> event) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await ApiService.triggerAchievementEvent(event);
      // Reload achievements
      await loadAchievements();
      await loadProfile();
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
      rethrow;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
