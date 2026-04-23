# TRtripsathi — Mobile (Flutter) README

This folder contains a minimal Flutter mobile app scaffold that connects to the TRtripsathi backend. The app includes:

- Signup (phone + password)
- Login (phone + password)
- Token storage (access + refresh) and automatic refresh
- Profile onboarding (first/last name, location, age, experience level)
- Global auth handling: when tokens are cleared (expired/refresh failed or logout) the app navigates the user to the login screen

Files of interest
- `lib/services/api.dart` — API client, token storage and automatic refresh logic
- `lib/screens/login.dart` — login UI and validation
- `lib/screens/signup.dart` — signup UI and validation
- `lib/screens/onboarding.dart` — profile completion UI and validation
- `lib/screens/profile.dart` — simple profile view and logout
- `lib/providers/auth_provider.dart` — global auth state notifier (navigates to login on token clear)
- `lib/main.dart` — app entry, loads `.env` and wires provider + navigator
- `pubspec.yaml` — app dependencies (includes `flutter_dotenv`, `provider`, `http`, `flutter_secure_storage`)

Quick overview of the auth flow
- Signup / Login endpoints: `POST /auth/signup` and `POST /auth/login` (backend uses phone number + password)
- Backend returns `accessToken` and `refreshToken` in the JSON body and also sets httpOnly cookies (the app uses returned tokens and stores them securely).
- When a protected request returns 401, the client attempts `POST /auth/refresh` sending the refresh token (in a Cookie header) and retries the original request once.
- If refresh fails, tokens are cleared and the app redirects the user to login.

Prerequisites (on your machine)
- Flutter SDK installed and on PATH
- Android SDK and platform tools (adb)
- A physical Android device with USB debugging enabled, or an Android emulator
- (Optional) For iOS builds you need a macOS machine with Xcode — not covered here

Configure backend URL
1. Copy `.env.example` to `.env` in this folder and edit `BACKEND_URL` to point to your backend (LAN IP or public URL):

```powershell
cd f:/TRtripsathi/Users
copy .env.example .env
notepad .env
```

2. `.env` is ignored by git; you can also override at runtime with `--dart-define=BACKEND_URL="..."`.

Run on a physical Android device (USB) — step-by-step (PowerShell)
1. Enable Developer Options and USB Debugging on the Android device:
	 - Settings -> About phone -> Tap "Build number" 7 times to enable Developer Options
	 - Developer Options -> Enable "USB debugging"

2. Connect the device to your Windows machine with a USB cable. On the device accept the "Allow USB debugging" prompt.

3. Verify the device is visible to adb and Flutter:

```powershell
# start from the Users folder
cd f:/TRtripsathi/Users
flutter pub get
# Check connected devices (this will list your phone)
flutter devices
# OR use adb directly
adb devices
```

If the device shows as `unauthorized` in `adb devices`, re-check the device screen and accept the prompt.

4. Run the app on the connected device:

```powershell
# Use .env value by default. To explicitly pass a backend url at runtime, use --dart-define
flutter run
# or specify device id if multiple devices are attached
# flutter run -d <device-id>
# override backend url (optional)
# flutter run --dart-define=BACKEND_URL="http://192.168.1.100:3000"
```

5. Build a release APK and install with adb (for testing or distribution):

```powershell
# build release APK (faster to test than full Play Store signing)
flutter build apk --release
# Install to device (adb must be in PATH)
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

Troubleshooting tips
- If `flutter devices` does not list your phone:
	- Ensure USB debugging is enabled and the USB cable supports data (some charge-only cables don't).
	- Install Android USB drivers for your phone on Windows (for some vendors).
	- Run `adb kill-server` then `adb start-server` and reconnect.

- If the app fails to reach backend on the device:
	- If your backend runs on localhost of your dev machine, use `10.0.2.2` for Android emulator.
	- For a physical device, run the backend on a machine reachable on the same LAN and use the machine's LAN IP (e.g. `http://192.168.1.100:3000`) in `.env`.
	- Ensure any firewall allows traffic to the backend port.

- If you see auth errors after login (401/403):
	- Check backend logs for token validation errors.
	- The client sends the refresh token via a Cookie header; ensure backend's refresh guard reads the cookie (your backend already supports this).

What we've implemented so far
- Scaffolded a Flutter app under `Users/` with screens and API wiring
- Signup, Login, Onboarding (profile) and Profile view
- Secure token storage with automatic refresh and retry
- Global auth provider that redirects the user to login when tokens are cleared
- `.env` configuration support and documentation for running on device

Next recommended steps (I can implement any of these):
- Proactive token refresh (refresh before expiry to avoid 401 flows)
- Better form validation and UX polish (error messages, loading states)
- Add app icons, Android package name, and Play Store signing setup
- Add unit/integration tests for the API client (token refresh behavior)

If you want me to add a short splash screen that shows the active `BACKEND_URL` for debugging or add platform-specific run scripts, tell me which one and I'll implement it.
