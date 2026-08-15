import 'package:flutter/widgets.dart';
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
