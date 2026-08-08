# TripSathi mobile app

The Flutter client uses a feature-first layout under `lib/features`, with shared networking, theme, navigation, and configuration in `lib/core`.

## API configuration

The application does not bundle `.env`. Pass the API origin at compile time:

```powershell
flutter run --dart-define="BACKEND_URL=http://80.225.195.197:8080"
```

For the included Android installation helper, copy `.env.example` to the ignored local `.env`, set `BACKEND_URL`, then run:

```powershell
.\run-android.ps1
```

An API URL is a public endpoint and can be discovered from app traffic or an APK. Never place database credentials, JWT secrets, password peppers, Cloudinary secrets, or private API keys in Flutter code, `.env`, assets, or `--dart-define` values.

Debug Android builds allow cleartext HTTP only for `80.225.195.197` and the emulator host `10.0.2.2`. Release builds require HTTPS and reject an HTTP URL. iOS and macOS also use their normal secure transport policy, so deploy the API behind TLS before releasing the app.

```powershell
flutter build apk --release --dart-define="BACKEND_URL=https://api.tripsathi.example"
```

Access and refresh tokens are saved with Android EncryptedSharedPreferences or the Apple Keychain through `flutter_secure_storage`. If an older development build used different Android storage options, users may need to sign in once again after upgrading.

## Development checks

```powershell
flutter pub get
flutter analyze
flutter test
```

If Android reports `INSTALL_FAILED_USER_RESTRICTED`, unlock the phone and approve USB installation in Developer Options; this is a device permission failure, not an API or Flutter build failure.
