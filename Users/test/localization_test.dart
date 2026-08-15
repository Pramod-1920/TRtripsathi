import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trtripsathi_mobile/core/localization/app_localizations.dart';
import 'package:trtripsathi_mobile/l10n/generated/app_localizations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('English and Nepali ARB resources are generated', () async {
    final english = await AppLocalizations.delegate.load(const Locale('en'));
    final nepali = await AppLocalizations.delegate.load(const Locale('ne'));

    expect(english.changeLanguage, 'Change language');
    expect(nepali.changeLanguage, 'भाषा परिवर्तन गर्नुहोस्');
    expect(nepali.profile, 'प्रोफाइल');
  });

  test('selected locale persists between controller instances', () async {
    SharedPreferences.setMockInitialValues({});
    final first = AppLocaleController();
    await first.load();
    await first.toggle();

    final restored = AppLocaleController();
    await restored.load();
    expect(restored.locale.languageCode, 'ne');
  });
}
