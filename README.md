# TRTripSathi

TRTripSathi is a travel-engagement platform with three applications:

- `backend/` — NestJS API using MongoDB, JWT authentication, profiles, XP, achievements, campaigns, trips, reviews, chat, notifications, and administrative services.
- `Admin/` — Next.js admin dashboard.
- `Users/` — Flutter user application targeting web and mobile.

This document records the current project state as of July 17, 2026, the work completed during the latest development cycle, and the most important work still required.

## Current local architecture

| Application | Technology | Local address |
| --- | --- | --- |
| Backend API | NestJS | `http://localhost:8080` |
| Admin dashboard | Next.js | `http://localhost:3000` |
| Flutter web | Flutter web server | `http://localhost:8081` |

The backend CORS allowlist currently accepts the Admin and Flutter web origins through:

```env
FRONTEND_URL=http://localhost:3000,http://localhost:8081
```

Do not commit real database passwords, JWT secrets, Cloudinary credentials, or production URLs.

## Work completed

### Flutter entry experience

- Added an animated TripSathi splash screen.
- Added a branded HTML loading screen for Flutter web.
- Added a custom Flutter web bootstrap containing the generated `flutter_js` and `flutter_build_config` tokens.
- Added a three-page introduction explaining discovery, travel streaks, XP, badges, and community.
- Added first-launch detection with `SharedPreferences`.
- New users follow `Splash → Introduction → Login/Signup`.
- Returning users follow `Splash → Login`.
- Splash navigation uses a direct, timer-driven transition so browser storage cannot leave it stuck.
- Added storage error handling around secure storage and preferences.

### Flutter authentication

- Rebuilt login with responsive Material 3 styling, validation, loading state, password visibility, and readable errors.
- Rebuilt signup as a two-step experience with an explorer-identity selection.
- Added password requirements that match the NestJS signup DTO:
  - at least six characters;
  - uppercase letter;
  - lowercase letter;
  - number;
  - supported special character.
- Added password and confirm-password visibility controls.
- Added phone-number validation for exactly ten digits.
- Corrected the Flutter API URL from port `3000` to backend port `8080`.
- Web defaults to `http://localhost:8080`.
- Android emulator defaults to `http://10.0.2.2:8080`.
- Added support for `--dart-define=API_BASE_URL=...` to override the API address.
- Successful signup now opens profile setup.
- Successful login opens the user dashboard/profile.
- Logout clears authentication and returns to login.

### Flutter profile setup

- Redesigned the screen with a branded hero, clear sections, icons, improved spacing, and Material 3 fields.
- Added required first name, age, email, province, district, place, and landmark inputs.
- Added optional middle name.
- Added last name input.
- Age is validated between 9 and 120.
- Email format is validated before submission.
- Added responsive dropdown behavior for long province, district, place, and rank labels.
- Dropdowns use available width and truncate long values instead of producing `RenderFlex` overflow.
- Replaced the generic profile error with the actual backend error.
- Removed client-controlled experience/rank selection. New accounts begin at the backend-controlled `F` rank.

### Flutter dashboard fixes

- Fixed escaped Dart interpolation that displayed literal placeholders for XP, level, name, phone, and location.
- Preserved profile loading, rank badge display, achievement popups, refresh behavior, and logout.
- Redirects incomplete profiles back to profile setup.

### Backend updates

- Backend runs locally on port `8080`.
- Added comma-separated CORS origin support.
- Added Flutter web origin `http://localhost:8081` alongside Admin origin `http://localhost:3000`.
- Verified the live Flutter signup preflight returns HTTP `204` with the correct `Access-Control-Allow-Origin` value.
- Added validated `age` support to `UpdateProfileDto`.
- Added `age` to the profile update allowlist.
- Age accepts integers from 9 through 120.
- Existing email update validation and uniqueness checks are used by profile setup.
- Backend builds successfully with `npm run build`.

### Admin dashboard fixes

- Identified browser-extension DOM mutation (`cz-shortcut-listen`) as the hydration-warning source.
- Added narrowly scoped hydration-warning suppression to the root body.
- Corrected login requests that previously went to the Next.js server and returned `404`.
- Removed hard-coded API localhost fallbacks from Admin source code.
- Admin reads `NEXT_PUBLIC_API_URL` from `Admin/.env.local` and fails clearly when it is missing.
- Centralized logout and authentication calls around the configured API URL.

## Running the project locally

### 1. Backend

Create `backend/.env` with valid values. Never copy production credentials into documentation.

```env
PORT=8080
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@VALID_CLUSTER_HOST/tripsathi
JWT_SECRET=replace_me
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000,http://localhost:8081
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
```

Run:

```powershell
cd backend
npm install
npm start
```

Only one backend process should listen on port `8080`. If code or `.env` changes, stop the existing process before restarting it.

### 2. Admin

Create `Admin/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Run:

```powershell
cd Admin
npm install
npm run dev
```

### 3. Flutter web

Run:

```powershell
cd Users
flutter pub get
flutter run -d web-server --web-port 8081
```

Open `http://localhost:8081`. After web bootstrap changes, use `Ctrl+Shift+R` or an Incognito window to bypass cached files.

Chrome remote-debugging launch has failed on the current development machine. The reliable workaround is `-d web-server`, or `flutter run -d edge`.

### 4. Flutter Android emulator

The default emulator API host is `http://10.0.2.2:8080`.

```powershell
flutter run -d <android-device-id>
```

Android development still requires the Android SDK to be installed and configured on this machine.

## Important behavior and limitations

- Explorer identity selection is currently a signup UI concept only. It is not persisted in MongoDB.
- The signup button displays “earn 50 XP,” but no verified backend event currently awards that XP. This copy must be removed or the reward must be implemented transactionally.
- Introduction completion is stored locally, not against the user account. Clearing browser storage shows onboarding again.
- Flutter web token storage uses `flutter_secure_storage_web`, which currently prevents WebAssembly compatibility. JavaScript web builds still work.
- The profile screen is still a basic profile/dashboard hybrid and is not the intended final product dashboard.
- Existing Flutter analysis contains style-level notices in legacy files, although the newly changed splash, profile-setup, and authentication screens compile.
- The Admin project has existing unrelated lint debt. The latest API and layout changes did not introduce targeted lint errors.
- Package upgrades are available in Flutter, but several require constraint and compatibility review rather than a blind bulk upgrade.

## Highest-priority next work

### P0 — Make authentication and onboarding production-safe

Why: account creation is the first critical user journey. Any inconsistency loses users and can leave partial accounts.

- Add automated end-to-end tests for signup, login, profile completion, logout, token refresh, duplicate phone, duplicate email, expired token, and backend-unavailable states.
- Decide how partial signup should work when account creation succeeds but profile completion fails.
- Add a resumable profile-setup state after login.
- Enforce required profile fields on the backend, not only in Flutter.
- Add OTP phone verification and email verification.
- Add forgot-password and account-recovery flows.
- Confirm refresh-token behavior on Flutter web and native mobile separately.

### P0 — Secure configuration and credentials

Why: database, JWT, and media credentials grant access to production data and services.

- Rotate any credentials that have been shared, logged, committed, or exposed during development.
- Replace placeholder JWT secrets with strong environment-specific secrets.
- Add safe `.env.example` files to each application.
- Confirm all real `.env` files are ignored by Git.
- Validate required environment variables during startup with clear messages.
- Use a secrets manager in deployment.

### P1 — Build the real user dashboard

Why: engagement promises made during onboarding need a useful destination.

- Create a dedicated home dashboard instead of using the profile screen as the landing page.
- Show a daily streak, today’s quest, XP progress, rank, next reward, recent activity, and recommended nearby places.
- Add bottom navigation for Home, Explore, Trips, Achievements, and Profile.
- Add skeleton states, empty states, retry actions, and offline messaging.
- Ensure every screen works at narrow phone widths, tablets, and web desktop widths.

### P1 — Implement the engagement system honestly

Why: rewards increase retention only when they are consistent, understandable, and protected against abuse.

- Decide whether explorer identity is cosmetic, recommendation data, or an achievement path.
- Persist the selected identity if it affects the experience.
- Implement daily check-ins and streak rules on the backend.
- Implement daily/weekly quests and XP ledger events.
- Award signup/profile-completion XP server-side exactly once, or remove the 50 XP claim.
- Add idempotency and abuse protection to all XP-awarding actions.
- Add notification preferences and reminder scheduling.

### P1 — Improve profile data design

Why: asking for age directly becomes stale and is less reliable than date of birth.

- Decide whether to collect age or date of birth. The backend already supports age calculation from `dateOfBirth`.
- If date of birth is adopted, replace the numeric age field with a date picker and calculate age only on the server.
- Decide which fields are truly required and document that contract in one shared source.
- Add profile photo upload and editing.
- Add privacy controls for location, age, email, and public profile visibility.

### P2 — Quality, maintenance, and deployment

- Resolve remaining Flutter analyzer notices and Admin lint debt.
- Add backend unit/integration tests and Flutter widget/golden tests.
- Add CI for formatting, linting, tests, and builds.
- Upgrade dependencies in small verified groups.
- Add structured logging and error monitoring.
- Add health/readiness endpoints covering MongoDB and other required services.
- Define development, staging, and production URLs and CORS policies.
- Add deployment documentation and database backup/restore procedures.

## Recommended next milestone

The next milestone should be **a tested, resumable authentication and profile-completion journey followed by a real home dashboard**.

Suggested order:

1. Add backend-required profile validation and end-to-end authentication tests.
2. Make incomplete profile setup resumable after every login.
3. Implement a dedicated dashboard shell and bottom navigation.
4. Implement daily streak and quest APIs with idempotent XP awards.
5. Connect dashboard widgets to those real APIs.
6. Add verification, password recovery, monitoring, and deployment configuration.

This order first stabilizes account access, then delivers the daily engagement value promised by the onboarding experience.
