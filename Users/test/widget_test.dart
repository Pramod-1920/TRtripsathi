import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trtripsathi_mobile/core/navigation/route_names.dart';
import 'package:trtripsathi_mobile/core/networking/api_service.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/login_page.dart';
import 'package:trtripsathi_mobile/features/auth/presentation/pages/signup_page.dart';

void main() {
  test('debug API defaults to the deployed backend', () {
    ApiService.configure();
    expect(ApiService.baseUrl, 'http://80.225.195.197:8080');
  });

  test('API URL normalization uses the backend port', () {
    ApiService.configure(overrideUrl: 'localhost');
    expect(ApiService.baseUrl, 'http://localhost:8080');
  });

  testWidgets('sign in validates identifier and password', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          RouteNames.signup: (_) => const Scaffold(body: Text('Signup')),
          RouteNames.dashboard: (_) => const Scaffold(body: Text('Dashboard')),
        },
        home: const LoginScreen(),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email or phone number'),
      '123',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'short',
    );
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();

    expect(
      find.text('Enter a valid email or 10-digit phone number'),
      findsOneWidget,
    );
    expect(find.text('Password must be at least 6 characters'), findsOneWidget);
  });

  test('Nepal phone numbers are normalized before authentication', () {
    expect(ApiService.normalizePhoneNumber('+977 984-123-4567'), '9841234567');
    expect(ApiService.normalizePhoneNumber('09841234567'), '9841234567');
    expect(ApiService.normalizePhoneNumber('9841234567'), '9841234567');
  });

  testWidgets('sign up includes traveler photo and middle name',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SignupScreen()));
    await tester.pump(const Duration(milliseconds: 750));

    expect(find.text('Add profile photo  •  Required'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Middle name'), findsOneWidget);
    expect(find.text('Create your\ntraveler account.'), findsOneWidget);
  });
}
