import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static String baseUrl = 'http://10.0.2.2:3000';
  static final _storage = FlutterSecureStorage();
  static const _accessKey = 'jwt';
  static const _refreshKey = 'refresh';
  /// Optional callback to notify the app about auth state changes.
  /// Set this from your AuthProvider to get updates when tokens are stored/cleared.
  static void Function(bool isAuthenticated)? onAuthStateChanged;

  /// Login - expects backend route POST /auth/login
  /// Returns parsed JSON map on success and stores token in secure storage
  static Future<Map<String, dynamic>> login(String phoneNumber, String password) async {
  final uri = Uri.parse('$baseUrl/auth/login');
    final res = await http.post(uri,
        headers: {'Content-Type': 'application/json'}, body: jsonEncode({'phoneNumber': phoneNumber, 'password': password}));
    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final token = body['accessToken'] ?? body['token'] ?? body['jwt'];
      final refresh = body['refreshToken'] ?? body['refresh'] ?? null;
      if (token != null) await _storage.write(key: _accessKey, value: token as String);
      if (refresh != null) await _storage.write(key: _refreshKey, value: refresh as String);
      // Notify app that we're authenticated
      try {
        onAuthStateChanged?.call(true);
      } catch (_) {}
      return body;
    }
    // Return parsed error body when possible for better UX
    try {
      final errorBody = jsonDecode(res.body);
      throw Exception('Login failed: \\$errorBody');
    } catch (_) {
      throw Exception('Login failed: HTTP \\${res.statusCode}');
    }
  }

  static Future<Map<String, dynamic>> getProfile() async {
  final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load profile: \\$res');
  }

  /// Signup - POST /auth/signup
  static Future<Map<String, dynamic>> signup(String phoneNumber, String password) async {
  final uri = Uri.parse('$baseUrl/auth/signup');
    final res = await http.post(uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phoneNumber': phoneNumber, 'password': password}));

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final token = body['accessToken'] ?? body['token'] ?? body['jwt'];
      final refresh = body['refreshToken'] ?? body['refresh'] ?? null;
      if (token != null) await _storage.write(key: _accessKey, value: token as String);
      if (refresh != null) await _storage.write(key: _refreshKey, value: refresh as String);
      try {
        onAuthStateChanged?.call(true);
      } catch (_) {}
      return body;
    }

    try {
      final errorBody = jsonDecode(res.body);
      throw Exception('Signup failed: \\$errorBody');
    } catch (_) {
      throw Exception('Signup failed: HTTP \\${res.statusCode}');
    }
  }

  /// Update profile - PATCH /user/profile
  static Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> updates) async {
  final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _patchWithAuth(uri, body: jsonEncode(updates));

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    try {
      final errorBody = jsonDecode(res.body);
      throw Exception('Update profile failed: \\$errorBody');
    } catch (_) {
      throw Exception('Update profile failed: HTTP \\${res.statusCode}');
    }
  }

  // --- Helper methods for auth + automatic refresh ---
  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';
    if (refresh != null) headers['Cookie'] = 'refresh_token=$refresh';
    return headers;
  }

  static Future<http.Response> _getWithAuth(Uri uri) async {
    final headers = await _getAuthHeaders();
    final res = await http.get(uri, headers: headers);
    if (res.statusCode == 401) {
      final refreshed = await _attemptRefresh();
      if (refreshed) {
        final headers2 = await _getAuthHeaders();
        return http.get(uri, headers: headers2);
      }
    }
    return res;
  }

  static Future<http.Response> _patchWithAuth(Uri uri, {String? body}) async {
    final headers = await _getAuthHeaders();
    final res = await http.patch(uri, headers: headers, body: body);
    if (res.statusCode == 401) {
      final refreshed = await _attemptRefresh();
      if (refreshed) {
        final headers2 = await _getAuthHeaders();
        return http.patch(uri, headers: headers2, body: body);
      }
    }
    return res;
  }

  static Future<bool> _attemptRefresh() async {
    final refresh = await _storage.read(key: _refreshKey);
    if (refresh == null) return false;

    try {
  final uri = Uri.parse('$baseUrl/auth/refresh');
      // Send refresh token via Cookie header so backend's JwtRefreshGuard can read it
      final res = await http.post(uri, headers: {'Content-Type': 'application/json', 'Cookie': 'refresh_token=$refresh'});
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final newAccess = body['accessToken'] ?? body['token'] ?? body['jwt'];
        final newRefresh = body['refreshToken'] ?? body['refresh'] ?? null;
        if (newAccess != null) await _storage.write(key: _accessKey, value: newAccess as String);
        if (newRefresh != null) await _storage.write(key: _refreshKey, value: newRefresh as String);
        try {
          onAuthStateChanged?.call(true);
        } catch (_) {}
        return true;
      }
    } catch (_) {
      // ignore
    }

    // If refresh failed, clear stored tokens and notify app
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    try {
      onAuthStateChanged?.call(false);
    } catch (_) {}
    return false;
  }

  static Future<void> logout() async {
    try {
      final token = await _storage.read(key: _accessKey);
  final uri = Uri.parse('$baseUrl/auth/logout');
      await http.post(uri, headers: token != null ? {'Authorization': 'Bearer $token'} : {});
    } catch (_) {}
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    try {
      onAuthStateChanged?.call(false);
    } catch (_) {}
  }
}
