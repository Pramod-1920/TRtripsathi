import 'package:flutter/material.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isAuthenticated = false;

  bool get isAuthenticated => _isAuthenticated;

  AuthProvider() {
    // register to ApiService notifications
    ApiService.onAuthStateChanged = (isAuth) {
      _setAuth(isAuth);
    };
  }

  /// Call once at startup to validate the refresh token with the backend.
  Future<void> initialize() async {
    _isAuthenticated = await ApiService.restoreSession();
  }

  void _setAuth(bool value) {
    if (_isAuthenticated != value) {
      _isAuthenticated = value;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await ApiService.logout();
    _setAuth(false);
  }

  /// Force check storage (useful if something changed outside provider)
  Future<void> refreshFromStorage() async {
    _setAuth(await ApiService.restoreSession());
  }
}
