import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:trtripsathi_mobile/core/networking/api_service.dart';

abstract final class FirebaseEnvironment {
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static FirebaseOptions? get options {
    if (apiKey.isEmpty ||
        appId.isEmpty ||
        messagingSenderId.isEmpty ||
        projectId.isEmpty) {
      return null;
    }
    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: messagingSenderId,
      projectId: projectId,
      storageBucket: storageBucket.isEmpty ? null : storageBucket,
    );
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final options = FirebaseEnvironment.options;
  await Firebase.initializeApp(options: options);
}

class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();
  static final reportStatusRevision = ValueNotifier<int>(0);

  FirebaseMessaging? _messaging;
  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  VoidCallback? _openReports;
  bool _pendingReportOpen = false;

  bool get isAvailable => _messaging != null;

  Future<void> initialize() async {
    if (kIsWeb || (!Platform.isAndroid && !Platform.isIOS)) return;
    try {
      await Firebase.initializeApp(options: FirebaseEnvironment.options);
      FirebaseMessaging.onBackgroundMessage(
        firebaseMessagingBackgroundHandler,
      );
      _messaging = FirebaseMessaging.instance;
      _messageSubscription = FirebaseMessaging.onMessage.listen((message) {
        if (_isReportStatusMessage(message)) {
          reportStatusRevision.value++;
        }
      });
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        _handleNotificationOpen,
      );
      _tokenSubscription = _messaging!.onTokenRefresh.listen(
        (token) => _registerToken(token),
      );

      final initialMessage = await _messaging!.getInitialMessage();
      if (initialMessage != null) _handleNotificationOpen(initialMessage);
    } catch (error) {
      _messaging = null;
      if (kDebugMode) debugPrint('Firebase messaging unavailable: $error');
    }
  }

  void setReportOpenHandler(VoidCallback handler) {
    _openReports = handler;
    if (_pendingReportOpen) {
      _pendingReportOpen = false;
      handler();
    }
  }

  void clearReportOpenHandler() => _openReports = null;

  Future<void> registerForCurrentUser() async {
    final messaging = _messaging;
    if (messaging == null) return;
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getBool('profile_notifications_enabled') == false) return;

    final permission = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    if (permission.authorizationStatus == AuthorizationStatus.denied) return;
    final token = await messaging.getToken();
    if (token != null && token.isNotEmpty) await _registerToken(token);
  }

  Future<void> unregisterCurrentDevice() async {
    final messaging = _messaging;
    if (messaging == null) return;
    final token = await messaging.getToken();
    if (token == null || token.isEmpty) return;
    try {
      await ApiService.unregisterPushToken(token);
    } catch (_) {
      // Logout and notification preference changes must remain usable if the
      // device is temporarily offline. FCM rotates stale tokens independently.
    }
  }

  Future<void> _registerToken(String token) async {
    try {
      await ApiService.registerPushToken(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
      );
    } catch (error) {
      if (kDebugMode) debugPrint('Push token registration failed: $error');
    }
  }

  bool _isReportStatusMessage(RemoteMessage message) =>
      message.data['type'] == 'report_status_changed' ||
      message.data['route'] == 'report_issue';

  void _handleNotificationOpen(RemoteMessage message) {
    if (!_isReportStatusMessage(message)) return;
    reportStatusRevision.value++;
    final handler = _openReports;
    if (handler == null) {
      _pendingReportOpen = true;
    } else {
      handler();
    }
  }

  Future<void> dispose() async {
    await _tokenSubscription?.cancel();
    await _messageSubscription?.cancel();
    await _openedSubscription?.cancel();
  }
}
