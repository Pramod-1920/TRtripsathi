import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';

class ApiService {
  static late String baseUrl;

  static void configure({String? overrideUrl}) {
    const definedUrl = String.fromEnvironment('API_BASE_URL');
    var configured = (overrideUrl ?? '').trim();
    if (configured.isEmpty) configured = definedUrl.trim();
    if (configured.isEmpty) {
      configured = kIsWeb || !Platform.isAndroid
          ? 'http://localhost:8080'
          : 'http://10.0.2.2:8080';
    }
    if (!configured.startsWith('http://') &&
        !configured.startsWith('https://')) {
      configured = 'http://$configured';
    }

    var uri = Uri.parse(configured);
    if (!uri.hasPort) uri = uri.replace(port: 8080);
    baseUrl = uri.toString().replaceFirst(RegExp(r'/$'), '');
  }

  static String readableError(Object error) {
    if (error is http.ClientException) {
      return 'Cannot reach the TripSathi server. Check that the backend is running and try again.';
    }
    final text = error.toString().replaceFirst('Exception: ', '');
    return text.isEmpty ? 'Something went wrong. Please try again.' : text;
  }

  static final _storage = FlutterSecureStorage();
  static const _accessKey = 'jwt';
  static const _refreshKey = 'refresh';

  /// Optional callback to notify the app about auth state changes.
  /// Set this from your AuthProvider to get updates when tokens are stored/cleared.
  static void Function(bool isAuthenticated)? onAuthStateChanged;

  // ============ Auth Endpoints ============

  /// POST /auth/signup - Create a new account
  static Future<Map<String, dynamic>> signup(
    String phoneNumber,
    String password, {
    String? firstName,
    String? middleName,
    File? profileImage,
  }) async {
    final uri = Uri.parse('$baseUrl/auth/signup');
    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'password': password,
        if (firstName != null) 'firstName': firstName,
        if (middleName != null) 'middleName': middleName,
      }),
    );

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      await _storeTokens(body);
      onAuthStateChanged?.call(true);

      // If the user picked a profile photo, upload to Cloudinary and then patch profile.
      // This requires auth (we already stored the JWT above).
      if (profileImage != null) {
        final upload = await _uploadProfileImageToCloudinary(profileImage);
        final secureUrl = upload['secure_url'] as String?;
        final publicId = upload['public_id'] as String?;
        if (secureUrl != null && secureUrl.isNotEmpty) {
          await updateProfile({
            if (firstName != null) 'firstName': firstName,
            if (middleName != null) 'middleName': middleName,
            'profilePhoto': secureUrl,
            if (publicId != null) 'profilePhotoPublicId': publicId,
          });
        }
      }

      return body;
    }
    throw Exception(_errorMessage(res, 'Unable to create account'));
  }

  static Future<Map<String, dynamic>> _getCloudinarySignature({
    String folder = 'profile_images',
  }) async {
    final uri = Uri.parse('$baseUrl/cloudinary/signature');
    final res = await _postWithAuth(uri, body: jsonEncode({'folder': folder}));
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to get upload signature: HTTP ${res.statusCode}');
  }

  static Future<Map<String, dynamic>> _uploadProfileImageToCloudinary(
    File image,
  ) async {
    final sig = await _getCloudinarySignature(folder: 'profile_images');
    final cloudName = (sig['cloudName'] ?? '').toString();
    final apiKey = (sig['apiKey'] ?? '').toString();
    final timestamp = (sig['timestamp'] ?? '').toString();
    final signature = (sig['signature'] ?? '').toString();
    final folder = (sig['folder'] ?? '').toString();

    if (cloudName.isEmpty ||
        apiKey.isEmpty ||
        timestamp.isEmpty ||
        signature.isEmpty) {
      throw Exception('Invalid upload signature response');
    }

    final uploadUri =
        Uri.parse('https://api.cloudinary.com/v1_1/$cloudName/image/upload');
    final req = http.MultipartRequest('POST', uploadUri);
    req.fields['api_key'] = apiKey;
    req.fields['timestamp'] = timestamp;
    req.fields['signature'] = signature;
    if (folder.isNotEmpty) req.fields['folder'] = folder;
    req.files.add(await http.MultipartFile.fromPath('file', image.path));

    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Image upload failed: HTTP ${res.statusCode} ${res.body}');
  }

  /// POST /auth/login - Login with phone and password
  static Future<Map<String, dynamic>> login(
      String phoneNumber, String password) async {
    final uri = Uri.parse('$baseUrl/auth/login');
    final res = await http.post(uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phoneNumber': phoneNumber, 'password': password}));

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      await _storeTokens(body);
      onAuthStateChanged?.call(true);
      return body;
    }
    throw Exception(_errorMessage(res, 'Unable to sign in'));
  }

  static String _errorMessage(http.Response response, String fallback) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is List) return message.join('\n');
        if (message != null && message.toString().trim().isNotEmpty) {
          return message.toString();
        }
      }
    } catch (_) {}
    return '$fallback (${response.statusCode})';
  }

  // ============ User Endpoints ============

  /// GET /user/profile - Get own profile
  static Future<Map<String, dynamic>> getProfile() async {
    final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception(_errorMessage(res, 'Unable to load profile'));
  }

  /// Update profile - PATCH /user/profile
  static Future<Map<String, dynamic>> updateProfile(
      Map<String, dynamic> updates) async {
    final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _patchWithAuth(uri, body: jsonEncode(updates));

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception(_errorMessage(res, 'Unable to update profile'));
  }

  /// DELETE /user/profile - Delete own account
  static Future<void> deleteProfile() async {
    final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _deleteWithAuth(uri);

    if (res.statusCode == 200) {
      await logout();
      return;
    }

    throw Exception('Failed to delete profile: HTTP ${res.statusCode}');
  }

  /// GET /user/profile/xp/history - Get XP history
  static Future<Map<String, dynamic>> getXpHistory({
    int page = 1,
    int limit = 20,
  }) async {
    final uri =
        Uri.parse('$baseUrl/user/profile/xp/history?page=$page&limit=$limit');
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to load XP history: HTTP ${res.statusCode}');
  }

  /// POST /user/xp/events - Trigger XP event
  static Future<Map<String, dynamic>> triggerXpEvent(String eventKey,
      [Map<String, dynamic>? context]) async {
    final uri = Uri.parse('$baseUrl/user/xp/events');
    final res = await _postWithAuth(uri,
        body: jsonEncode({'eventKey': eventKey, 'context': context ?? {}}));

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to trigger XP event: HTTP ${res.statusCode}');
  }

  /// POST /user/achievements/events - Record achievement event
  static Future<Map<String, dynamic>> triggerAchievementEvent(
      Map<String, dynamic> event) async {
    final uri = Uri.parse('$baseUrl/user/achievements/events');
    final res = await _postWithAuth(uri, body: jsonEncode(event));

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception(
        'Failed to record achievement event: HTTP ${res.statusCode}');
  }

  /// GET /user/achievements - Get user achievements
  static Future<List<dynamic>> getAchievements() async {
    final uri = Uri.parse('$baseUrl/user/achievements');
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return body['achievements'] as List<dynamic>? ?? [];
    }
    throw Exception('Failed to load achievements: HTTP ${res.statusCode}');
  }

  // ============ Trips Endpoints ============

  /// GET /trips - List all trips
  static Future<Map<String, dynamic>> listTrips({
    int page = 1,
    int limit = 20,
    String? status,
    String? activityType,
    String? difficulty,
    String? province,
    String? district,
    double? lat,
    double? lng,
    int? maxDistance,
  }) async {
    final params = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (status != null) 'status': status,
      if (activityType != null) 'activityType': activityType,
      if (difficulty != null) 'difficulty': difficulty,
      if (province != null) 'province': province,
      if (district != null) 'district': district,
      if (lat != null) 'lat': lat.toString(),
      if (lng != null) 'lng': lng.toString(),
      if (maxDistance != null) 'maxDistance': maxDistance.toString(),
    };

    final uri = Uri.parse('$baseUrl/trips').replace(queryParameters: params);
    final res = await _getWithAuth(uri);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load trips: HTTP ${res.statusCode}');
  }

  /// POST /trips - Create a new trip
  static Future<Map<String, dynamic>> createTrip(
      Map<String, dynamic> tripData) async {
    final uri = Uri.parse('$baseUrl/trips');
    final res = await _postWithAuth(uri, body: jsonEncode(tripData));

    if (res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to create trip: HTTP ${res.statusCode}');
  }

  /// GET /trips/{id} - Get trip details
  static Future<Map<String, dynamic>> getTripDetails(String tripId) async {
    final uri = Uri.parse('$baseUrl/trips/$tripId');
    final res = await _getWithAuth(uri);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load trip: HTTP ${res.statusCode}');
  }

  /// PATCH /trips/{id} - Update trip
  static Future<Map<String, dynamic>> updateTrip(
      String tripId, Map<String, dynamic> updates) async {
    final uri = Uri.parse('$baseUrl/trips/$tripId');
    final res = await _patchWithAuth(uri, body: jsonEncode(updates));

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to update trip: HTTP ${res.statusCode}');
  }

  /// DELETE /trips/{id} - Delete trip
  static Future<void> deleteTrip(String tripId) async {
    final uri = Uri.parse('$baseUrl/trips/$tripId');
    final res = await _deleteWithAuth(uri);

    if (res.statusCode == 200) {
      return;
    }

    throw Exception('Failed to delete trip: HTTP ${res.statusCode}');
  }

  /// POST /trips/{id}/join - Join a trip
  static Future<Map<String, dynamic>> joinTrip(String tripId) async {
    final uri = Uri.parse('$baseUrl/trips/$tripId/join');
    final res = await _postWithAuth(uri, body: jsonEncode({'tripId': tripId}));

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to join trip: HTTP ${res.statusCode}');
  }

  /// POST /trips/{id}/checkin - Checkin to a trip location
  static Future<Map<String, dynamic>> checkinToTrip(String tripId,
      {double? latitude, double? longitude}) async {
    final uri = Uri.parse('$baseUrl/trips/$tripId/checkin');
    final res = await _postWithAuth(uri,
        body: jsonEncode({
          'tripId': tripId,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
        }));

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to checkin: HTTP ${res.statusCode}');
  }

  // ============ Reviews Endpoints ============

  /// GET /reviews - List reviews
  static Future<Map<String, dynamic>> listReviews({
    int page = 1,
    int limit = 20,
    String? targetType,
    String? targetId,
  }) async {
    final params = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (targetType != null) 'targetType': targetType,
      if (targetId != null) 'targetId': targetId,
    };

    final uri = Uri.parse('$baseUrl/reviews').replace(queryParameters: params);
    final res = await _getWithAuth(uri);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load reviews: HTTP ${res.statusCode}');
  }

  /// POST /reviews - Create a review
  static Future<Map<String, dynamic>> createReview(
      Map<String, dynamic> reviewData) async {
    final uri = Uri.parse('$baseUrl/reviews');
    final res = await _postWithAuth(uri, body: jsonEncode(reviewData));

    if (res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to create review: HTTP ${res.statusCode}');
  }

  /// PATCH /reviews/{id} - Update review
  static Future<Map<String, dynamic>> updateReview(
      String reviewId, Map<String, dynamic> updates) async {
    final uri = Uri.parse('$baseUrl/reviews/$reviewId');
    final res = await _patchWithAuth(uri, body: jsonEncode(updates));

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to update review: HTTP ${res.statusCode}');
  }

  /// DELETE /reviews/{id} - Delete review
  static Future<void> deleteReview(String reviewId) async {
    final uri = Uri.parse('$baseUrl/reviews/$reviewId');
    final res = await _deleteWithAuth(uri);

    if (res.statusCode == 200) {
      return;
    }

    throw Exception('Failed to delete review: HTTP ${res.statusCode}');
  }

  // ============ Campaigns Endpoints ============

  /// GET /campaigns - List campaigns
  static Future<Map<String, dynamic>> listCampaigns({
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    final params = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (status != null) 'status': status,
    };

    final uri =
        Uri.parse('$baseUrl/campaigns').replace(queryParameters: params);
    final res = await _getWithAuth(uri);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load campaigns: HTTP ${res.statusCode}');
  }

  /// GET /campaigns/{id} - Get campaign details
  static Future<Map<String, dynamic>> getCampaignDetails(
      String campaignId) async {
    final uri = Uri.parse('$baseUrl/campaigns/$campaignId');
    final res = await _getWithAuth(uri);

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to load campaign: HTTP ${res.statusCode}');
  }

  /// POST /campaigns/{id}/join - Join a campaign
  static Future<Map<String, dynamic>> joinCampaign(String campaignId) async {
    final uri = Uri.parse('$baseUrl/campaigns/$campaignId/join');
    final res = await _postWithAuth(uri, body: jsonEncode({}));

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }

    throw Exception('Failed to join campaign: HTTP ${res.statusCode}');
  }

  // ============ Extra/Places Endpoints ============

  /// GET /extra/places - Get place hierarchy
  static Future<List<dynamic>> getPlaceHierarchy() async {
    final uri = Uri.parse('$baseUrl/extra/places');
    final res =
        await http.get(uri, headers: {'Content-Type': 'application/json'});
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return body['items'] as List<dynamic>? ?? [];
    }
    throw Exception('Failed to load place hierarchy: ${res.statusCode}');
  }

  // ============ Helper Methods ============

  /// Store tokens from response
  static Future<void> _storeTokens(Map<String, dynamic> body) async {
    final token = body['accessToken'] ?? body['token'] ?? body['jwt'];
    final refresh = body['refreshToken'] ?? body['refresh'];
    if (token is! String || token.isEmpty) {
      throw Exception(
          'Authentication response did not include an access token');
    }
    await _storage.write(key: _accessKey, value: token);
    if (refresh is String && refresh.isNotEmpty) {
      await _storage.write(key: _refreshKey, value: refresh);
    }
  }

  /// Get auth headers with token
  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await _storage.read(key: _accessKey);
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  /// GET request with auth and refresh
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

  /// POST request with auth and refresh
  static Future<http.Response> _postWithAuth(Uri uri, {String? body}) async {
    final headers = await _getAuthHeaders();
    final res = await http.post(uri, headers: headers, body: body);
    if (res.statusCode == 401) {
      final refreshed = await _attemptRefresh();
      if (refreshed) {
        final headers2 = await _getAuthHeaders();
        return http.post(uri, headers: headers2, body: body);
      }
    }
    return res;
  }

  /// PATCH request with auth and refresh
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

  /// DELETE request with auth and refresh
  static Future<http.Response> _deleteWithAuth(Uri uri) async {
    final headers = await _getAuthHeaders();
    final res = await http.delete(uri, headers: headers);
    if (res.statusCode == 401) {
      final refreshed = await _attemptRefresh();
      if (refreshed) {
        final headers2 = await _getAuthHeaders();
        return http.delete(uri, headers: headers2);
      }
    }
    return res;
  }

  static Future<bool>? _refreshInFlight;

  static Future<bool> _attemptRefresh() {
    final activeRefresh = _refreshInFlight;
    if (activeRefresh != null) return activeRefresh;

    final refresh = _performRefresh();
    _refreshInFlight = refresh;
    refresh.whenComplete(() => _refreshInFlight = null);
    return refresh;
  }

  static Future<bool> _performRefresh() async {
    final refresh = await _storage.read(key: _refreshKey);
    if (refresh == null) return false;

    try {
      final uri = Uri.parse('$baseUrl/auth/refresh');
      // Send refresh token via Cookie header so backend's JwtRefreshGuard can read it
      final res = await http.post(uri, headers: {
        'Content-Type': 'application/json',
        'Cookie': 'refresh_token=$refresh',
      });
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        await _storeTokens(body);
        onAuthStateChanged?.call(true);
        return true;
      }
    } catch (_) {
      // Treat transport and malformed-response failures as an expired session.
    }

    // If refresh failed, clear stored tokens and notify app
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    onAuthStateChanged?.call(false);
    return false;
  }

  static Future<void> logout() async {
    try {
      final token = await _storage.read(key: _accessKey);
      final uri = Uri.parse('$baseUrl/auth/logout');
      await http.post(
        uri,
        headers: token != null ? {'Authorization': 'Bearer $token'} : {},
      );
    } catch (_) {}
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    onAuthStateChanged?.call(false);
  }
}
