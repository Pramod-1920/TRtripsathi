import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trtripsathi_mobile/screens/auth/login.dart';
import 'package:trtripsathi_mobile/services/api.dart';

void main() {
  test('API URL normalization uses the backend port', () {
    ApiService.configure(overrideUrl: 'localhost');
    expect(ApiService.baseUrl, 'http://localhost:8080');
  });

  testWidgets('login validates phone number and password', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          '/signup': (_) => const Scaffold(body: Text('Signup')),
          '/dashboard': (_) => const Scaffold(body: Text('Dashboard')),
        },
        home: const LoginScreen(),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Phone number'),
      '123',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Password'),
      'short',
    );
    await tester.tap(find.text('Continue journey'));
    await tester.pump();

    expect(find.text('Enter your 10-digit phone number'), findsOneWidget);
    expect(find.text('Password must be at least 6 characters'), findsOneWidget);
  });
}
