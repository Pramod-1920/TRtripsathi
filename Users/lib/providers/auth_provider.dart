import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api.dart';

class AuthProvider extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  bool _isAuthenticated = false;

  bool get isAuthenticated => _isAuthenticated;

  AuthProvider() {
    _init();
    // register to ApiService notifications
    ApiService.onAuthStateChanged = (isAuth) {
      _setAuth(isAuth);
    };
  }

  Future<void> _init() async {
    final token = await _storage.read(key: 'jwt');
    _setAuth(token != null);
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
    final token = await _storage.read(key: 'jwt');
    _setAuth(token != null);
  }
}
