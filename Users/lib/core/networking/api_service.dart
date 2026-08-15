import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiRateLimitException implements Exception {
  const ApiRateLimitException(this.retryAfterSeconds);

  final int retryAfterSeconds;

  @override
  String toString() =>
      'Too many attempts. Try again in $retryAfterSeconds seconds.';
}

class ApiService {
  static late String baseUrl;
  static Map<String, dynamic>? _cachedProfile;

  static Map<String, dynamic>? get cachedProfile => _cachedProfile == null
      ? null
      : Map<String, dynamic>.from(_cachedProfile!);

  static void configure({String? overrideUrl}) {
    const definedUrl = String.fromEnvironment('BACKEND_URL');
    var configured = (overrideUrl ?? '').trim();
    if (configured.isEmpty) configured = definedUrl.trim();
    if (configured.isEmpty && kDebugMode) {
      // Development convenience only. API origins are public identifiers, not
      // secrets; credentials and signing keys must remain on the backend.
      configured = 'http://80.225.195.197:8080';
    }
    if (configured.isEmpty) {
      throw StateError(
        'BACKEND_URL is required. Pass it with '
        '--dart-define=BACKEND_URL=https://api.example.com.',
      );
    }
    if (!configured.startsWith('http://') &&
        !configured.startsWith('https://')) {
      configured = 'http://$configured';
    }

    var uri = Uri.parse(configured);
    if (!uri.hasScheme || uri.host.isEmpty || uri.userInfo.isNotEmpty) {
      throw StateError('BACKEND_URL must be a valid HTTP(S) URL.');
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw StateError('BACKEND_URL must use HTTP or HTTPS.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw StateError('Release builds require an HTTPS BACKEND_URL.');
    }
    if (!uri.hasPort && uri.scheme == 'http') {
      uri = uri.replace(port: 8080);
    }
    baseUrl = uri.toString().replaceFirst(RegExp(r'/$'), '');
  }

  static String readableError(Object error) {
    if (error is ApiRateLimitException) return error.toString();
    if (error is http.ClientException) {
      return 'Cannot reach the TripSathi server. Check that the backend is running and try again.';
    }
    final text = error.toString().replaceFirst('Exception: ', '');
    return text.isEmpty ? 'Something went wrong. Please try again.' : text;
  }

  static String normalizePhoneNumber(String rawValue) {
    var digits = rawValue.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 13 && digits.startsWith('977')) {
      digits = digits.substring(3);
    } else if (digits.length == 11 && digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    return digits;
  }

  static ApiRateLimitException _rateLimitException(http.Response response) {
    final retryAfter =
        int.tryParse(response.headers['retry-after'] ?? '') ?? 60;
    return ApiRateLimitException(retryAfter.clamp(1, 3600));
  }

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );
  static const _accessKey = 'jwt';
  static const _refreshKey = 'refresh';
  static const _identityKey = 'account_identity';

  static Future<bool> hasStoredAccessToken() async {
    try {
      final token = await _storage.read(key: _accessKey);
      return token != null && token.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Restores a server-validated session at app startup. A cached access token
  /// alone is never enough because it may already be expired or revoked.
  static Future<bool> restoreSession() async {
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null || refreshToken.isEmpty) {
      await _storage.delete(key: _accessKey);
      await _storage.delete(key: _identityKey);
      onAuthStateChanged?.call(false);
      return false;
    }
    return _attemptRefresh();
  }

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
    String? lastName,
    String? email,
    String? address,
    String? gender,
    String? dateOfBirth,
    File? profileImage,
  }) async {
    final uri = Uri.parse('$baseUrl/auth/signup');
    final fullPayload = {
      'phoneNumber': phoneNumber,
      'password': password,
      if (firstName != null) 'firstName': firstName,
      if (middleName != null) 'middleName': middleName,
      if (lastName != null) 'lastName': lastName,
      if (email != null) 'email': email,
      if (address != null) 'address': address,
      if (gender != null) 'gender': gender,
      if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
    };
    var usedLegacySignup = false;
    var res = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(fullPayload),
        )
        .timeout(const Duration(seconds: 15));

    // The currently deployed API may still use the older signup DTO. Create
    // the auth record with that contract, then persist the remaining fields
    // through the authenticated profile endpoint below.
    if (res.statusCode == 400 && res.body.contains('should not exist')) {
      usedLegacySignup = true;
      res = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'phoneNumber': phoneNumber,
              'password': password,
              if (firstName != null) 'firstName': firstName,
              if (middleName != null) 'middleName': middleName,
            }),
          )
          .timeout(const Duration(seconds: 15));
    }

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      await _storeTokens(body);
      await _cacheAccountIdentity(body);
      await _cacheAccountIdentity(fullPayload);
      onAuthStateChanged?.call(true);

      if (usedLegacySignup) {
        final legacyProfile = <String, dynamic>{
          if (firstName != null) 'firstName': firstName,
          if (middleName != null) 'middleName': middleName,
          if (lastName != null) 'lastName': lastName,
          if (email != null) 'email': email,
          if (address != null) 'location': address,
          if (gender != null) 'gender': gender,
          if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
        };
        try {
          await updateProfile(legacyProfile);
          body['_legacyProfileSaved'] = true;
        } catch (error) {
          // Authentication was committed by the legacy endpoint. Preserve a
          // retry payload instead of telling the user account creation failed.
          body['_legacyProfileSaved'] = false;
          body['_legacyProfileError'] = readableError(error);
        }
      }

      // If the user picked a profile photo, upload to Cloudinary and then patch profile.
      // This requires auth (we already stored the JWT above).
      if (profileImage != null) {
        try {
          await uploadProfileImage(profileImage);
          body['_profilePhotoUploaded'] = true;
        } catch (error) {
          // The account is already committed. Let the next profile step retry
          // the image instead of presenting a duplicate-account failure.
          body['_profilePhotoUploaded'] = false;
          body['_profilePhotoUploadError'] = readableError(error);
        }
      }

      return body;
    }
    if (res.statusCode == 429) throw _rateLimitException(res);
    throw Exception(_errorMessage(res, 'Unable to create account'));
  }

  static Future<Map<String, dynamic>> _getCloudinarySignature({
    String folder = 'profile_images',
  }) async {
    final uri = Uri.parse('$baseUrl/cloudinary/signature');
    final res = await _postWithAuth(uri, body: jsonEncode({'folder': folder}));
    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to get upload signature: HTTP ${res.statusCode}');
  }

  static Future<Map<String, dynamic>> _uploadProfileImageToCloudinary(
    File image, {
    String folder = 'profile_images',
    String resourceType = 'image',
  }) async {
    final sig = await _getCloudinarySignature(folder: folder);
    final cloudName = (sig['cloudName'] ?? '').toString();
    final apiKey = (sig['apiKey'] ?? '').toString();
    final timestamp = (sig['timestamp'] ?? '').toString();
    final signature = (sig['signature'] ?? '').toString();
    final signedFolder = (sig['folder'] ?? '').toString();

    if (cloudName.isEmpty ||
        apiKey.isEmpty ||
        timestamp.isEmpty ||
        signature.isEmpty) {
      throw Exception('Invalid upload signature response');
    }

    final uploadUri = Uri.parse(
      'https://api.cloudinary.com/v1_1/$cloudName/$resourceType/upload',
    );
    final req = http.MultipartRequest('POST', uploadUri);
    req.fields['api_key'] = apiKey;
    req.fields['timestamp'] = timestamp;
    req.fields['signature'] = signature;
    if (signedFolder.isNotEmpty) req.fields['folder'] = signedFolder;
    req.files.add(await http.MultipartFile.fromPath('file', image.path));

    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Image upload failed: HTTP ${res.statusCode} ${res.body}');
  }

  static Future<String> uploadProfileImage(File image) async {
    final upload = await _uploadProfileImageToCloudinary(image);
    final secureUrl = upload['secure_url'] as String?;
    final publicId = upload['public_id'] as String?;
    if (secureUrl == null || secureUrl.isEmpty) {
      throw Exception('Image upload did not return a secure URL');
    }
    await updateProfile({
      'profilePhoto': secureUrl,
      if (publicId != null && publicId.isNotEmpty)
        'profilePhotoPublicId': publicId,
    });
    return secureUrl;
  }

  static Future<Map<String, String>> uploadCampaignImage(File image) async {
    final upload = await _uploadProfileImageToCloudinary(
      image,
      folder: 'campaigns',
    );
    final secureUrl = (upload['secure_url'] ?? '').toString();
    final publicId = (upload['public_id'] ?? '').toString();
    if (secureUrl.isEmpty) {
      throw Exception('Campaign image upload did not return a secure URL');
    }
    return {'url': secureUrl, 'publicId': publicId};
  }

  static Future<String> uploadPlaceVerificationImage(File image) async {
    final upload = await _uploadProfileImageToCloudinary(
      image,
      folder: 'place_verification',
    );
    final secureUrl = (upload['secure_url'] ?? '').toString();
    if (secureUrl.isEmpty) {
      throw Exception('Place photo upload did not return a secure URL');
    }
    return secureUrl;
  }

  static Future<Map<String, dynamic>> submitPlacePhotoVerification({
    required String photoUrl,
    required String title,
    required String category,
    required String province,
    required String district,
    required String municipality,
    required String place,
    required String address,
    double? latitude,
    double? longitude,
  }) async {
    final res = await _postWithAuth(
      Uri.parse('$baseUrl/user/photos/verification-requests'),
      body: jsonEncode({
        'url': photoUrl,
        'kind': 'solo',
        'title': title.trim(),
        'category': category,
        'province': province,
        'district': district,
        'municipality': municipality,
        'place': place,
        'address': address.trim(),
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      }),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Unable to submit place photo'));
  }

  static Future<Map<String, String>> uploadCampaignEvidence(
    File file, {
    required String mediaType,
  }) async {
    if (mediaType != 'image' && mediaType != 'video') {
      throw ArgumentError.value(
          mediaType, 'mediaType', 'Must be image or video');
    }
    final upload = await _uploadProfileImageToCloudinary(
      file,
      folder: 'campaign_verification',
      resourceType: mediaType,
    );
    final secureUrl = (upload['secure_url'] ?? '').toString();
    final publicId = (upload['public_id'] ?? '').toString();
    if (secureUrl.isEmpty) {
      throw Exception('Evidence upload did not return a secure URL');
    }
    return {'url': secureUrl, 'publicId': publicId, 'mediaType': mediaType};
  }

  /// POST /auth/login - Login with email/phone and password
  static Future<Map<String, dynamic>> login(
      String identifier, String password) async {
    final uri = Uri.parse('$baseUrl/auth/login');
    final rawIdentifier = identifier.trim();
    final isEmail = rawIdentifier.contains('@');
    final normalizedIdentifier = isEmail
        ? rawIdentifier.toLowerCase()
        : normalizePhoneNumber(rawIdentifier);
    final res = await http
        .post(uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              if (isEmail)
                'email': normalizedIdentifier
              else
                'phoneNumber': normalizedIdentifier,
              'password': password,
            }))
        .timeout(const Duration(seconds: 15));

    if (res.statusCode == 200 || res.statusCode == 201) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      await _storeTokens(body);
      await _cacheAccountIdentity(body);
      await _cacheAccountIdentity({
        if (isEmail)
          'email': normalizedIdentifier
        else
          'phoneNumber': normalizedIdentifier,
      });
      onAuthStateChanged?.call(true);
      return body;
    }
    if (res.statusCode == 429) throw _rateLimitException(res);
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
  static Future<Map<String, dynamic>> getProfile({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _cachedProfile != null) {
      return Map<String, dynamic>.from(_cachedProfile!);
    }
    final uri = Uri.parse('$baseUrl/user/profile');
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      final profile = _normalizeProfileResponse(
        jsonDecode(res.body) as Map<String, dynamic>,
      );

      _fillMissingIdentity(profile, await _readCachedAccountIdentity());
      _cachedProfile = Map<String, dynamic>.from(profile);
      await _cacheAccountIdentity(profile);

      // Older servers may keep contact identity only under /auth/me. That
      // compatibility request must not delay rendering the profile screen.
      unawaited(_mergeAuthIdentityIntoProfileCache(profile));
      return Map<String, dynamic>.from(profile);
    }
    throw Exception(_errorMessage(res, 'Unable to load profile'));
  }

  static Future<void> _mergeAuthIdentityIntoProfileCache(
    Map<String, dynamic> profile,
  ) async {
    try {
      final authResponse = await _getWithAuth(Uri.parse('$baseUrl/auth/me'));
      if (authResponse.statusCode != 200) return;
      final merged = Map<String, dynamic>.from(profile);
      final authData = _normalizeProfileResponse(
        jsonDecode(authResponse.body) as Map<String, dynamic>,
      );
      _fillMissingIdentity(merged, authData);
      _cachedProfile = merged;
      await _cacheAccountIdentity(merged);
    } catch (_) {}
  }

  /// Update profile - PATCH /user/profile
  static Future<Map<String, dynamic>> updateProfile(
      Map<String, dynamic> updates) async {
    final uri = Uri.parse('$baseUrl/user/profile');
    final normalizedUpdates = _normalizeProfileUpdate(updates);
    var res = await _patchWithAuth(uri, body: jsonEncode(normalizedUpdates));

    if (res.statusCode == 200) {
      final updated = await _readUpdatedProfile(res);
      _cachedProfile = Map<String, dynamic>.from(updated);
      return updated;
    }

    // Compatibility for older deployed APIs that validate PATCH requests like
    // full profile replacements. Preserve every existing field, normalize all
    // arrays, then let the caller's requested fields win.
    if (!normalizedUpdates.containsKey('phoneNumber') &&
        _isLegacyFullProfileRequirement(res)) {
      final currentProfile = await getProfile();
      final profileSnapshot = _completeProfilePayload(currentProfile);

      if (profileSnapshot.isNotEmpty) {
        res = await _patchWithAuth(
          uri,
          body: jsonEncode({...profileSnapshot, ...normalizedUpdates}),
        );
        if (res.statusCode == 200) return _readUpdatedProfile(res);
      }
    }

    throw Exception(_errorMessage(res, 'Unable to update profile'));
  }

  // ============ Reports & feedback endpoints ============

  /// POST /reports/feedback - Send a product issue or suggestion to moderation.
  static Future<Map<String, dynamic>> submitFeedback({
    required String reason,
    required String description,
  }) async {
    final response = await _postWithAuth(
      Uri.parse('$baseUrl/reports/feedback'),
      body: jsonEncode({
        'reason': reason,
        'description': description.trim(),
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    if (response.statusCode == 429) throw _rateLimitException(response);
    throw Exception(_errorMessage(response, 'Unable to send your report'));
  }

  /// GET /reports/mine - Load the signed-in traveler's submission history.
  static Future<Map<String, dynamic>> getMyReports({
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse('$baseUrl/reports/mine').replace(
      queryParameters: {'page': '$page', 'limit': '$limit'},
    );
    final response = await _getWithAuth(uri);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to load your reports'));
  }

  static Future<void> registerPushToken({
    required String token,
    required String platform,
  }) async {
    final response = await _postWithAuth(
      Uri.parse('$baseUrl/notifications/push-token'),
      body: jsonEncode({'token': token, 'platform': platform}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) return;
    throw Exception(
        _errorMessage(response, 'Unable to register notifications'));
  }

  static Future<void> unregisterPushToken(String token) async {
    final encodedToken = Uri.encodeComponent(token);
    final response = await _deleteWithAuth(
      Uri.parse('$baseUrl/notifications/push-token/$encodedToken'),
    );
    if (response.statusCode == 200 || response.statusCode == 204) return;
    throw Exception(
      _errorMessage(response, 'Unable to unregister notifications'),
    );
  }

  static Future<Map<String, dynamic>> getChatConversations({
    int page = 1,
    int limit = 50,
  }) async {
    final uri = Uri.parse('$baseUrl/chat/conversations').replace(
      queryParameters: {'page': '$page', 'limit': '$limit'},
    );
    final response = await _getWithAuth(uri);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to load conversations'));
  }

  static Future<Map<String, dynamic>> searchChatTravelers(
    String query, {
    int page = 1,
    int limit = 30,
  }) async {
    final uri = Uri.parse('$baseUrl/user/search').replace(
      queryParameters: {
        if (query.trim().isNotEmpty) 'q': query.trim(),
        'page': '$page',
        'limit': '$limit',
      },
    );
    final response = await _getWithAuth(uri);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to find travelers'));
  }

  static Future<Map<String, dynamic>> startPrivateChat(
    String recipientId,
  ) async {
    final response = await _postWithAuth(
      Uri.parse('$baseUrl/chat/conversations/person-to-person'),
      body: jsonEncode({'recipientId': recipientId}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to start conversation'));
  }

  static Future<Map<String, dynamic>> getChatMessages(
    String chatGroupId, {
    int page = 1,
    int limit = 50,
  }) async {
    final uri = Uri.parse('$baseUrl/chat/messages/$chatGroupId').replace(
      queryParameters: {'page': '$page', 'limit': '$limit'},
    );
    final response = await _getWithAuth(uri);
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to load messages'));
  }

  static Future<Map<String, dynamic>> sendChatMessage(
    String chatGroupId,
    String content,
  ) async {
    final response = await _postWithAuth(
      Uri.parse('$baseUrl/chat/messages'),
      body: jsonEncode({
        'chatGroupId': chatGroupId,
        'messageType': 'text',
        'content': content.trim(),
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    }
    throw Exception(_errorMessage(response, 'Unable to send message'));
  }

  static Future<void> markChatMessagesRead(List<String> messageIds) async {
    if (messageIds.isEmpty) return;
    final response = await _patchWithAuth(
      Uri.parse('$baseUrl/chat/messages/mark-read'),
      body: jsonEncode({'messageIds': messageIds}),
    );
    if (response.statusCode != 200) {
      throw Exception(_errorMessage(response, 'Unable to mark messages read'));
    }
  }

  static Future<Map<String, dynamic>> _readUpdatedProfile(
    http.Response response,
  ) async {
    final updated = _normalizeProfileResponse(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
    _cachedProfile = Map<String, dynamic>.from(updated);
    await _cacheAccountIdentity(updated);
    return updated;
  }

  static bool _isLegacyFullProfileRequirement(http.Response response) {
    if (response.statusCode < 400 || response.statusCode >= 500) return false;
    final message = response.body.toLowerCase();
    final mentionsProfileField = message.contains('phone') ||
        message.contains('email') ||
        message.contains('language') ||
        message.contains('interest') ||
        message.contains('profile');
    final isRequirement = message.contains('required') ||
        message.contains('must be') ||
        message.contains('should not be empty') ||
        message.contains('digit') ||
        message.contains('array');
    return mentionsProfileField && isRequirement;
  }

  static Map<String, dynamic> _completeProfilePayload(
    Map<String, dynamic> profile,
  ) {
    final phone = normalizePhoneNumber(
      (profile['phoneNumber'] ?? '').toString(),
    );
    final email = (profile['email'] ?? '').toString().trim().toLowerCase();
    final interests = _normalizeStringList(profile['travelInterests']);

    final payload = <String, dynamic>{
      if (RegExp(r'^\d{10}$').hasMatch(phone)) 'phoneNumber': phone,
      if (RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) 'email': email,
      for (final key in const [
        'firstName',
        'middleName',
        'lastName',
        'dateOfBirth',
        'profilePhoto',
        'profilePhotoPublicId',
        'bio',
        'location',
        'province',
        'district',
        'landmark',
        'experienceLevel',
        'gender',
        'travelerExperience',
        'travelStyle',
      ])
        if (profile[key] != null) key: profile[key],
      'languagesKnown': _normalizeStringList(
        profile['languagesKnown'] ?? profile['languages'],
      ),
      if (interests.length >= 2) 'travelInterests': interests,
      'isProfilePublic': profile['isProfilePublic'] != false,
    };
    return _normalizeProfileUpdate(payload);
  }

  static Map<String, dynamic> _normalizeProfileUpdate(
    Map<String, dynamic> updates,
  ) {
    final normalized = <String, dynamic>{...updates};
    for (final key in const ['languagesKnown', 'travelInterests']) {
      if (normalized.containsKey(key)) {
        normalized[key] = _normalizeStringList(normalized[key]);
      }
    }
    return normalized;
  }

  static Map<String, dynamic> _normalizeProfileResponse(
    Map<String, dynamic> response,
  ) {
    final normalized = <String, dynamic>{...response};

    for (var depth = 0; depth < 3; depth++) {
      for (final key in const ['data', 'user', 'profile', 'account']) {
        final nested = normalized[key];
        if (nested is Map) {
          normalized.addAll(Map<String, dynamic>.from(nested));
        }
      }
    }

    final nestedName = normalized['name'];
    if (nestedName is Map) {
      normalized.putIfAbsent('firstName', () => nestedName['first']);
      normalized.putIfAbsent('middleName', () => nestedName['middle']);
      normalized.putIfAbsent('lastName', () => nestedName['last']);
    }
    if (_isMissingIdentityValue(normalized['location']) &&
        !_isMissingIdentityValue(normalized['address'])) {
      normalized['location'] = normalized['address'];
    }
    if (_isMissingIdentityValue(normalized['dateOfBirth']) &&
        !_isMissingIdentityValue(normalized['dob'])) {
      normalized['dateOfBirth'] = normalized['dob'];
    }
    normalized['languagesKnown'] = _normalizeStringList(
      normalized['languagesKnown'] ?? normalized['languages'],
    );
    normalized['travelInterests'] =
        _normalizeStringList(normalized['travelInterests']);

    return normalized;
  }

  static List<String> _normalizeStringList(dynamic value) {
    final Iterable<dynamic> values = value is Iterable && value is! String
        ? value
        : (value ?? '').toString().split(',');
    return values
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();
  }

  static void _fillMissingIdentity(
    Map<String, dynamic> target,
    Map<String, dynamic> source,
  ) {
    for (final key in const [
      'firstName',
      'middleName',
      'lastName',
      'phoneNumber',
      'email',
      'dateOfBirth',
      'age',
    ]) {
      if (_isMissingIdentityValue(target[key]) &&
          !_isMissingIdentityValue(source[key])) {
        target[key] = source[key];
      }
    }
  }

  static bool _isMissingIdentityValue(dynamic value) =>
      value == null || (value is String && value.trim().isEmpty);

  static Future<Map<String, dynamic>> _readCachedAccountIdentity() async {
    try {
      final encoded = await _storage.read(key: _identityKey);
      if (encoded == null || encoded.isEmpty) return {};
      return Map<String, dynamic>.from(jsonDecode(encoded) as Map);
    } catch (_) {
      return {};
    }
  }

  static Future<void> _cacheAccountIdentity(
    Map<String, dynamic> response,
  ) async {
    final normalized = _normalizeProfileResponse(response);
    final identity = <String, dynamic>{
      ...await _readCachedAccountIdentity(),
    };
    for (final key in const [
      'firstName',
      'middleName',
      'lastName',
      'phoneNumber',
      'email',
      'dateOfBirth',
      'age',
    ]) {
      if (!_isMissingIdentityValue(normalized[key])) {
        identity[key] = normalized[key];
      }
    }
    if (identity.isNotEmpty) {
      await _storage.write(key: _identityKey, value: jsonEncode(identity));
    }
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

  /// GET /visited-places/mine - Verified travel coverage for this user.
  static Future<Map<String, dynamic>> getMyVisitedPlaces() async {
    final res = await _getWithAuth(Uri.parse('$baseUrl/visited-places/mine'));
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Unable to load travel history'));
  }

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

    throw Exception(_errorMessage(res, 'Unable to load campaigns'));
  }

  /// POST /campaigns - Create a scheduled user campaign.
  static Future<Map<String, dynamic>> createCampaign(
    Map<String, dynamic> campaignData,
  ) async {
    final res = await _postWithAuth(
      Uri.parse('$baseUrl/campaigns'),
      body: jsonEncode(campaignData),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Unable to create campaign'));
  }

  /// PATCH /campaigns/{id} - Update a campaign owned by the signed-in user.
  static Future<Map<String, dynamic>> updateCampaign(
    String campaignId,
    Map<String, dynamic> campaignData,
  ) async {
    final res = await _patchWithAuth(
      Uri.parse('$baseUrl/campaigns/$campaignId'),
      body: jsonEncode(campaignData),
    );
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Unable to update campaign'));
  }

  /// DELETE /campaigns/{id} - Delete a campaign owned by the signed-in user.
  static Future<void> deleteCampaign(String campaignId) async {
    final res = await _deleteWithAuth(
      Uri.parse('$baseUrl/campaigns/$campaignId'),
    );
    if (res.statusCode == 200 || res.statusCode == 204) return;
    throw Exception(_errorMessage(res, 'Unable to delete campaign'));
  }

  /// GET /campaigns/mine - Every campaign hosted by the signed-in user.
  static Future<Map<String, dynamic>> listMyCampaigns({
    int page = 1,
    int limit = 100,
  }) async {
    final uri = Uri.parse('$baseUrl/campaigns/mine').replace(
      queryParameters: {'page': '$page', 'limit': '$limit'},
    );
    final res = await _getWithAuth(uri);
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    // The saved-ID compatibility path remains available until this endpoint
    // reaches older deployed servers. On those servers, `mine` can be handled
    // by the older `/:id` route and produce an ObjectId/campaign-not-found
    // response instead of a normal 404.
    if (res.statusCode == 404) {
      return {'items': <dynamic>[], '_legacyUnavailable': true};
    }
    final legacyRouteBody = res.body.toLowerCase();
    final isLegacyMineRoute = res.statusCode == 500 ||
        (res.statusCode == 400 &&
            (legacyRouteBody.contains('objectid') ||
                legacyRouteBody.contains('cast to') ||
                legacyRouteBody.contains('campaign not found')));
    if (isLegacyMineRoute) {
      return {'items': <dynamic>[], '_legacyUnavailable': true};
    }
    throw Exception(_errorMessage(res, 'Unable to load your campaigns'));
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

  static Future<Map<String, dynamic>> getPrivateCampaignByCode(
    String code,
  ) async {
    final normalized = code.trim().toUpperCase();
    final encoded = Uri.encodeComponent(
      normalized.startsWith('#') ? normalized : '#$normalized',
    );
    final res = await _getWithAuth(
      Uri.parse('$baseUrl/campaigns/code/$encoded'),
    );
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Private campaign not found'));
  }

  /// Uploading evidence within the 24-hour window automatically verifies the
  /// completed campaign and lets the backend award XP.
  static Future<Map<String, dynamic>> verifyCampaignCompletion(
    String campaignId,
    Map<String, String> evidence,
  ) async {
    final res = await _postWithAuth(
      Uri.parse('$baseUrl/campaigns/$campaignId/verify'),
      body: jsonEncode({
        'url': evidence['url'],
        'publicId': evidence['publicId'],
        'mediaType': evidence['mediaType'],
      }),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
    }
    throw Exception(_errorMessage(res, 'Unable to verify trip completion'));
  }

  /// POST /campaigns/{id}/join - Join a campaign
  static Future<Map<String, dynamic>> joinCampaign(
    String campaignId, {
    String? code,
  }) async {
    final uri = Uri.parse('$baseUrl/campaigns/$campaignId/join');
    final res = await _postWithAuth(
      uri,
      body: jsonEncode({if (code != null) 'code': code}),
    );

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

  /// GET /extra/activities - Enabled Admin-managed activity hierarchy.
  static Future<List<dynamic>> getActivityHierarchy() async {
    final uri = Uri.parse('$baseUrl/extra/activities');
    final res =
        await http.get(uri, headers: {'Content-Type': 'application/json'});
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final items = body['items'] as List<dynamic>? ?? [];
      if (items.isNotEmpty) return items;
    }

    // Compatibility for the currently deployed backend, where the public
    // activity catalog route is not deployed yet and /extra/activities is
    // interpreted as the protected /extra/:id endpoint. Public campaigns
    // still contain the exact server-validated category/subcategory names.
    if (res.statusCode == 200 ||
        res.statusCode == 401 ||
        res.statusCode == 403 ||
        res.statusCode == 404) {
      final campaignResponse = await _getWithAuth(
        Uri.parse('$baseUrl/campaigns').replace(
          queryParameters: {'page': '1', 'limit': '100'},
        ),
      );
      if (campaignResponse.statusCode == 200) {
        final body = jsonDecode(campaignResponse.body) as Map<String, dynamic>;
        final campaigns =
            (body['items'] ?? body['data']) as List<dynamic>? ?? const [];
        final categories = <String, Set<String>>{};
        for (final campaign in campaigns.whereType<Map>()) {
          final category = (campaign['category'] ?? '').toString().trim();
          final subcategory = (campaign['subcategory'] ?? '').toString().trim();
          if (category.isEmpty) continue;
          categories.putIfAbsent(category, () => <String>{});
          if (subcategory.isNotEmpty) categories[category]!.add(subcategory);
        }
        if (categories.isNotEmpty) {
          return categories.entries
              .map((entry) => {
                    'name': entry.key,
                    'subcategories':
                        entry.value.map((name) => {'name': name}).toList(),
                  })
              .toList();
        }
      }
    }
    throw Exception(
      'The activity catalog is not available on the deployed backend yet. '
      'Deploy or restart the updated backend and retry.',
    );
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
      }).timeout(const Duration(seconds: 12));
      if (res.statusCode == 200 || res.statusCode == 201) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        await _storeTokens(body);
        await _cacheAccountIdentity(body);
        onAuthStateChanged?.call(true);
        return true;
      }
    } catch (_) {
      // Treat transport and malformed-response failures as an expired session.
    }

    // If refresh failed, clear stored tokens and notify app
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _identityKey);
    _cachedProfile = null;
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
    await _storage.delete(key: _identityKey);
    _cachedProfile = null;
    onAuthStateChanged?.call(false);
  }
}
