import 'package:trtripsathi_mobile/core/networking/api_service.dart';

abstract final class AppEnvironment {
  static Future<void> load() async {
    ApiService.configure();
  }
}
