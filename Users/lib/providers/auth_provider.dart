import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api.dart';

class AuthProvider extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  bool _isAuthenticated = false;

  bool get isAuthenticated => _isAuthenticated;

  AuthProvider() {
    // register to ApiService notifications
    ApiService.onAuthStateChanged = (isAuth) {
      _setAuth(isAuth);
    };
  }

<<<<<<< HEAD
  /// Call once at startup (before runApp) to eagerly hydrate auth state.
  Future<void> initialize() async {
    try {
      final token = await _storage.read(key: 'jwt');
      _isAuthenticated = token != null;
    } catch (_) {
      _isAuthenticated = false;
=======
  Future<void> _init() async {
    try {
      final token = await _storage.read(key: 'jwt');
      _setAuth(token != null);
    } catch (_) {
      _setAuth(false);
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
    }
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
    try {
      final token = await _storage.read(key: 'jwt');
      _setAuth(token != null);
    } catch (_) {
      _setAuth(false);
    }
  }
}
