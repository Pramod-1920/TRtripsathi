import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppLocaleController extends ChangeNotifier {
  Locale _locale = const Locale('en');
  Locale get locale => _locale;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _locale = Locale(prefs.getString('app_locale') == 'ne' ? 'ne' : 'en');
    notifyListeners();
  }

  Future<void> toggle() async {
    _locale = Locale(_locale.languageCode == 'en' ? 'ne' : 'en');
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('app_locale', _locale.languageCode);
  }
}

class AppStrings {
  const AppStrings(this.locale);
  final Locale locale;

  static const supportedLocales = [Locale('en'), Locale('ne')];
  static const LocalizationsDelegate<AppStrings> delegate =
      _AppStringsDelegate();
  static AppStrings of(BuildContext context) =>
      Localizations.of<AppStrings>(context, AppStrings)!;

  bool get isNepali => locale.languageCode == 'ne';
  String get appName => isNepali ? 'यात्री' : 'Trip Sathi';
  String get offline => isNepali
      ? 'अफलाइन — सुरक्षित गरिएको जानकारी देखाइँदैछ'
      : 'Offline — showing saved information';
  String get changeLanguage =>
      isNepali ? 'भाषा परिवर्तन गर्नुहोस्' : 'Change language';
  String get retry => isNepali ? 'फेरि प्रयास गर्नुहोस्' : 'Retry';
}

class _AppStringsDelegate extends LocalizationsDelegate<AppStrings> {
  const _AppStringsDelegate();
  @override
  bool isSupported(Locale locale) => ['en', 'ne'].contains(locale.languageCode);
  @override
  Future<AppStrings> load(Locale locale) =>
      SynchronousFuture(AppStrings(locale));
  @override
  bool shouldReload(_AppStringsDelegate old) => false;
}
