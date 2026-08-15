# TripSathi — Complete Project Context for Claude

Last updated: 2026-08-16

This file is the primary AI handoff document for TripSathi. It explains what the product is, how the repository is organized, what has been implemented, the important business and security rules, what has been verified locally, and what still needs work.

Read this file before suggesting or changing anything. For a longer human-oriented history, also read [`README.md`](README.md). When documentation and source code disagree, inspect the source and treat the backend implementation as the authority for security and business rules.

## 1. Product summary

TripSathi is a Nepal-focused travel and gamification platform with three applications:

- A Flutter mobile app for travelers.
- A NestJS backend for authentication, trips, campaigns, reports, verified visits, XP, notifications, moderation, and administration.
- A Next.js admin application for administrators and moderators.

The main product loop is:

1. A traveler discovers or visits a real place in Nepal.
2. The traveler submits photo evidence with a catalog place and current GPS position.
3. The backend validates the submission and an admin or moderator reviews it.
4. Approval awards XP exactly once and marks the appropriate place and district as visited.
5. The user map shows district and province progress across Nepal.

The integrity of verified visits, XP, district completion, and account recovery is a core product requirement. Client-side checks are only for user experience; the backend must enforce all important rules.

## 2. Repository structure

```text
TRtripsathi/
├── backend/                 NestJS API, MongoDB models, jobs and integrations
├── Admin/                   Next.js administration application
├── Users/                   Flutter traveler application
├── README.md                Detailed human-facing project documentation
└── CLAUDE.md                AI handoff and implementation context
```

High-level data flow:

```text
Flutter app ─────┐
                 ├── HTTPS/JSON ── NestJS API ── MongoDB
Next.js Admin ───┘                       │
                                        ├── Cloudinary: uploaded media
                                        ├── Firebase Cloud Messaging: push notifications
                                        ├── Email/SMS provider: verification and recovery OTP
                                        ├── Redis: optional shared infrastructure
                                        └── Geocoding/weather services
```

## 3. Technology stack

### Backend

- NestJS 11 and TypeScript.
- MongoDB with Mongoose.
- JWT access and refresh authentication, using cookies and/or bearer tokens according to the client.
- Role-based access control for `User`, `Admin`, and `Moderator`.
- Cloudinary-backed media uploads.
- Firebase Admin SDK for FCM notifications.
- Email and optional SMS delivery for verification/recovery codes.
- Scheduled campaign lifecycle maintenance.
- Structured NDJSON logging, health checks, metrics, alerts, and audit history.

### Admin

- Next.js 16 App Router.
- React 19 and TypeScript.
- Tailwind CSS.
- Axios-based API access and Zustand where shared client state is needed.

### Flutter user app

- Flutter/Dart, Dart SDK constraint `>=3.6.0 <4.0.0`.
- Provider-based state management.
- HTTP networking, secure token storage, and shared preferences.
- Firebase Messaging for push notifications.
- `flutter_map` for Nepal travel progress.
- Geolocator for evidence coordinates.

## 4. Roles and authorization

There are three roles:

- `User`: can create feedback, file reports/complaints, submit visit evidence, manage their own profile, and use traveler functionality.
- `Moderator`: can review and resolve moderation work, but cannot file a traveler complaint.
- `Admin`: can manage the platform and moderation work, but cannot file a traveler complaint.

Role checks must exist on the backend. Hiding buttons in Flutter or Next.js is not considered security.

Important report rule: only a `User` may create a complaint/report. Admins and moderators are reviewers and resolvers.

## 5. Delivered work

### Phase 1 — Trust and integrity

#### Account verification and recovery

- Forgot-password supports the account's registered email and Nepal phone workflow where configured.
- OTPs are exactly six numeric digits.
- An OTP expires after three minutes.
- Resend has a 60-second cooldown.
- Password recovery exposes `POST /auth/password/resend` using the opaque challenge ID; Flutter disables resend during the cooldown and adopts the replacement challenge after a successful resend.
- Verification is attempt-limited, currently five attempts per code.
- Requests are rate-limited per account and purpose, currently five per hour.
- Recovery responses are enumeration-safe and do not reveal whether an account exists.
- Resetting a password invalidates existing refresh sessions/tokens.
- Reset also fails if the registered recovery email/phone changed after the code was issued; the old challenge is consumed without changing the password.
- OTP delivery uses the registered contact resolved by the backend, not an arbitrary destination supplied for delivery.
- New account/contact verification flows exist for email and phone where applicable.
- Legacy accounts have an explicit migration/verification state rather than silently being treated as newly verified.
- Credentials such as mail application passwords remain in environment variables and must never be committed or printed.

#### Backend-enforced profile completion

- Required profile fields are validated by backend DTO/service logic.
- Flutter mirrors the requirements for immediate UX feedback, but it is not the source of truth.
- The backend prevents protected workflows from being bypassed through direct API calls.

#### Verified-place anti-fraud controls

- A submitted place must exist in the managed place catalog.
- Places can have trusted latitude, longitude, and an allowed verification radius.
- The backend calculates the Haversine distance between submitted GPS coordinates and the trusted place coordinate.
- Evidence outside the configured radius cannot be approved as a valid visit.
- GPS freshness and accuracy are considered; stale or unusably inaccurate locations must not pass silently.
- Upload type and size restrictions are enforced on the backend.
- Exact duplicate images are detected with a SHA-256 content fingerprint.
- A rejected submission requires a meaningful reason.
- A rejected item has a controlled appeal path; it is not an unlimited resubmission loophole.
- Photo appeals atomically transition the same rejected request back to pending exactly once, preserve its original evidence/hash, require the User role, and are audited.
- Approval is idempotent: retrying or concurrently submitting the same approval cannot award XP twice.

#### XP rules

- A standalone approved place verification awards 40 XP.
- Standalone visit uniqueness uses the canonical District + Municipality + Place context.
- The XP ledger is the source of truth for idempotency.
- Ledger reservations use a unique compound key of user and award context. An unfinished reservation can be completed safely on retry, while the profile XP/history mutation uses an atomic conditional update.
- Campaign participation uses the XP configured by that campaign rather than the standalone fixed amount.
- Signup UI no longer promises an XP reward unless a real backend transaction awards it.
- `travelerExperience`/Explorer identity is persisted rather than being display-only state.

#### Fraud controls still considered future hardening

- Exact-hash duplicate protection does not detect cropped, compressed, resized, or visually similar copies.
- EXIF can provide supporting information but must never be the sole proof because it can be removed or forged.
- Perceptual hashing, device attestation, risk scoring, and stronger abuse detection are future improvements if real abuse justifies them.

### Reports, feedback, and live status behavior

- Feedback and reports use explicit workflows, not automatic keyword classification.
- General feedback is created through `POST /reports/feedback` and appears in the Feedback area.
- A complaint against a target uses `POST /reports/:targetId` and appears in the Reports area.
- Only traveler users can create complaints.
- Admins and moderators can inspect, assign, investigate, update, and resolve them.
- The legacy “reporter profile not found” path was repaired by resolving/repairing the user's companion profile correctly.
- Admin report updates are reflected immediately in local UI state and reconciled with the server.
- Admin pages can silently refresh while focused, including an approximately eight-second report reconciliation interval.
- The Flutter report screen fetches when opened.
- It fetches when the application returns to the foreground.
- Manual pull-to-refresh remains available.
- When an admin changes report status, the backend sends an FCM notification to the affected user.
- Opening that notification triggers one report refresh.
- Flutter does not continuously poll report status for every user; this prevents unnecessary database and CPU load at scale.

### Notifications

- The Admin application has a notification button in the top navigation.
- Notifications are also reachable from the sidebar and a dedicated notification page.
- The main admin feed includes report activity, campaign creation activity, and photo verification requests.
- FCM is used for traveler-facing status notifications.
- The Firebase Admin integration includes compatibility handling for the installed package version.
- Production Firebase credentials/configuration are deployment concerns and are not stored in documentation.

### Campaign lifecycle

- Expired campaigns/trips are excluded from active campaign tabs.
- Backend lifecycle housekeeping runs on a schedule.
- Campaign creation, approval, details, reviews, ownership, archive/bin, and related admin flows exist.
- Scheduler behavior should be coordinated before horizontally scaling to multiple backend instances.

### Nepal map and visited-place progress

- The traveler map is restricted to Nepal rather than displaying the whole world as the primary experience.
- Nepal progress is organized into 7 provinces and 77 districts.
- Visited districts are highlighted in green.
- District and province visit counts are shown.
- A province is complete only when every district in that province has been completed.
- Approved place evidence updates the user's place/district progress.
- A user who does not know the district can select a managed place; the place hierarchy determines its municipality, district, and province.
- The no-pinned-active-destination state was corrected.
- The canonical district registry includes official/common aliases and has coverage tests for all 77 districts.
- Current boundary geometry is a simplified visualization. It must not be described as legal or survey-grade administrative geometry.

### Places hierarchy and administration

- Places follow the hierarchy Province → District → Municipality → Place.
- Admins can add a place title under the correct hierarchy.
- Place records support category and subcategory selection.
- Place records support trusted coordinates and a verification radius.
- Weather/geocoding helpers can assist administration, but saved trusted coordinates remain an administrative decision.
- Existing-place trust metadata can be previewed or atomically applied through admin-only `POST /extra/places/trust-backfill`; preview mode is the default and does not write.
- API/UI normalization handles older hierarchy records where arrays such as `places` are absent, preventing `.length` errors.
- Existing production place records may still require metadata backfill.

### Photo verification

- Users submit a photo, title, location/address, category, selected catalog place, and current GPS evidence.
- Admins/moderators review submissions through the verification queue.
- Approval awards XP once and updates map/place progress.
- Rejection requires a reason and can support a controlled appeal.
- Location validity is determined by server-side place and distance rules, not by title text such as “Pashupati Temple.”

### Phase 3 — Finish or hide half-features

- Treasure Hunt has backend foundations but is not considered a complete user/admin feature.
- Its admin navigation entry is hidden and `/treasurehunt` redirects to the dashboard.
- Media moderation has schema/service/component foundations but lacks a complete controller, route, navigation flow, and test coverage.
- Media moderation is hidden until it is complete.
- Neither hidden feature should be advertised as delivered or re-exposed without finishing authorization, workflows, validation, and tests.
- Nepal district identity was validated against the canonical 77-district registry and official/common aliases.
- The simplified visual polygons still need replacement with authoritative Survey Department/official machine-readable geometry if precise boundaries are required.

### Phase 4 — Operations polish

#### Structured logging

- Backend application logs use structured NDJSON through `backend/src/observability/structured-logger.ts`.
- Sensitive keys and common secret fields are redacted.
- PM2 combines backend stdout and stderr into `backend/logs/backend.log` through `backend/ecosystem.config.cjs`.
- Backend `.log` files are kept under `backend/logs/` to keep the project root clean.
- Audit records are also mirrored to `backend/logs/audit.log` for operational convenience.
- Production log rotation must still be configured at the host/PM2 level.

#### Health, metrics, monitoring, and alerts

- `GET /health` provides an overall health response.
- `GET /health/live` is the liveness endpoint.
- `GET /health/ready` checks MongoDB and optional configured Redis, returning HTTP 503 when a required dependency is not ready.
- `GET /health/metrics` exposes application metrics.
- Metrics access is protected with an `x-monitoring-token` whenever `MONITORING_TOKEN` is configured; production fails closed if it is missing.
- Metrics and alert services are grouped in the observability module.
- Alert webhooks support configurable 5xx thresholds and cooldowns.
- Expected environment names include `MONITORING_TOKEN`, `ALERT_WEBHOOK_URL`, `ALERT_5XX_THRESHOLD`, and `ALERT_COOLDOWN_MS`.
- Monitoring exists in source, but a production dashboard, uptime checker, and alert destination still need deployment configuration.

#### Audit history

- Moderation and administrative audit events are stored in MongoDB in the `audit_events` collection.
- Legacy JSONL audit events can be imported idempotently.
- Optional external/S3 mirroring remains supported where configured.
- Report status/assignment changes and place patch/bulk changes produce explicit audit events.
- Existing campaign, photo verification, and administrative actions also feed audit history where wired.
- Admins/moderators can query `GET /audit/events`; user accounts are rejected by the existing JWT/role guards.
- Audit events normalize actor, entity type, and entity ID and can be filtered by action prefix, actor, entity, and date range.
- The Admin application includes a filterable `/audit` page and sidebar entry.

#### Accessibility, localization, and offline behavior

- The Flutter application has a persisted English/Nepali language preference.
- A language control is available from the Dashboard.
- Core application shell/navigation strings use generated English and Nepali ARB resources under `Users/lib/l10n/`.
- Full feature-by-feature translation is not complete.
- Offline/connectivity state is tracked and exposed with a live semantic banner.
- Network calls involved in authentication use bounded timeouts, currently 15 seconds.
- An encrypted cached profile can be used as a limited offline fallback.
- Offline mode is not a full offline-first data synchronization system.
- Release accessibility testing with screen readers and large text remains necessary.

## 6. Current Admin application surface

The Admin application includes or routes to:

- `/dashboard`
- `/users`
- `/notifications`
- `/photo-verification-queue`
- `/reports`
- `/audit`
- `/analytics`
- `/campaigns/add`
- `/campaigns/details`
- `/campaigns/details/[id]`
- `/campaigns/approval`
- `/campaigns/bin`
- `/campaigns/reviews`
- `/my-campaign`
- `/extra/places`
- `/extra/activities`
- `/extra/difficulty`
- `/extra/xp`
- `/extra/badge`
- `/profile`

`/treasurehunt` intentionally redirects to the dashboard. There is no completed media-moderation admin route.

## 7. Important backend modules

The backend is organized around these domains:

- `auth`: login, refresh, logout, verification, recovery, OTP delivery and session security.
- `user`: account/profile administration and traveler profile state.
- `campaign`: campaigns, approval, lifecycle and campaign evidence.
- `trip`: traveler trip workflows.
- `extra`: managed places, hierarchy, categories, activities, difficulty and related catalog data.
- `xp-ledger`: append-style XP award history and idempotency.
- `achievement` and `badge`: progression rewards.
- `review`: review workflows.
- `report`: feedback, complaints, assignment and resolution.
- `notification`: admin notifications, device tokens and FCM delivery.
- `visited-place`: place/district/province progress.
- `chat`: chat functionality.
- `media`: incomplete moderation foundations; keep hidden.
- `treasure-hunt`: incomplete feature foundations; keep hidden.
- `audit`: durable administrative/moderation history.
- `observability`: logger, metrics, alerts and health support.
- `admin`: supporting administrative endpoints and services.

Inspect the controllers and DTOs for the exact current endpoint contract before changing a client.

## 8. Core data concepts

Exact schema names can change, so inspect Mongoose schemas before migrations. The important concepts are:

- Authentication account: credentials, role, verification state and refresh-session state.
- User profile: traveler identity, required fields, level, rank and XP-facing profile state.
- Place hierarchy: province, district, municipality and place, with aliases and metadata.
- Trusted place position: latitude, longitude and allowed verification radius.
- Photo/visit evidence: user, selected place, image, submitted GPS, review state and reason/appeal information.
- Visited-place progress: approved place and district completion state.
- XP ledger entry: reason, amount, context and a uniqueness/idempotency key.
- Campaign and campaign participation/evidence.
- Feedback and targeted report/complaint.
- Notification and device token.
- Audit event: actor, action, entity, before/after or contextual metadata, timestamp and correlation information.

Do not update XP only by mutating a profile total. Any new reward path must create an idempotent ledger event and update derived profile progression transactionally or through the established service.

## 9. Critical business invariants

Any proposal or implementation must preserve these rules:

1. The backend is authoritative for validation, authorization, XP, verification and completion.
2. Only the `User` role creates traveler complaints; admins/moderators review them.
3. Feedback and targeted reports are explicitly selected workflows, not guessed from message text.
4. OTPs are six digits, expire in three minutes, are rate/attempt limited, and go only to the backend-resolved registered contact.
5. Password reset revokes previous refresh sessions.
6. Photo approval requires a real catalog place and a valid server-side distance check when trusted coordinates are available/required.
7. An evidence approval or retry can never grant duplicate XP.
8. Standalone approved place verification awards 40 XP; campaigns use campaign-configured XP.
9. Province completion requires every canonical district in that province.
10. Push/event-driven refresh is preferred over continuous per-user polling.
11. Simplified district polygons are visual aids, not legal boundaries.
12. Treasure Hunt and media moderation stay hidden until their end-to-end workflows are complete.
13. Administrative and moderation mutations should produce searchable audit history.
14. Never log access tokens, refresh tokens, passwords, OTPs, provider credentials, or full secret-bearing request payloads.

## 10. Configuration and secrets

Never copy actual values from `.env` files into documentation, issues, chat, logs, commits, or generated output.

Configuration categories include:

- Runtime: port, environment and public/base URLs.
- MongoDB connection.
- JWT access/refresh secrets and expiry settings.
- Cookie/CORS/frontend origin settings.
- Cloudinary credentials.
- Firebase service-account/FCM credentials.
- Email sender and application/provider credentials.
- Optional SMS provider credentials.
- Optional Redis connection.
- Monitoring token and alert webhook settings.
- Optional audit external-storage settings.
- Admin `NEXT_PUBLIC_API_URL`.
- Flutter compile-time `BACKEND_URL`.

Use the example environment files and source configuration validation for exact variable names. If an environment variable is changed for a PM2-managed service, restart with updated environment values.

## 11. Local development and verification

### Backend

```bash
cd backend
npm install
npm run build
npm test
npm run start:dev
```

The production build entry is `dist/src/main.js`, not `dist/main.js`.

### Admin

```bash
cd Admin
npm install
npm run build
npm run dev
```

### Flutter

```bash
cd Users
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=BACKEND_URL=http://localhost:8080
```

Use HTTPS for release builds and real devices.

### Latest local verification status

At the end of the Phase 4 work:

- Backend TypeScript/Nest build passed.
- Backend tests passed: 46/46 across 13 suites, including OTP security boundaries, geofence, evidence duplicate, trusted-coordinate backfill, concurrent XP/photo-approval, appeal-state, readiness failure, protected metrics, and audit authorization/filter coverage.
- Admin production build passed and included `/audit`.
- Flutter analyzer reported no issues.
- Flutter tests passed: 17/17, including generated English/Nepali resources and persisted locale selection.

These results prove the checked-out source built and passed its local suite at that time. They do not prove that the latest revision is deployed, that external providers are correctly configured, or that production data has been migrated/backfilled.

## 12. Production deployment notes

Typical backend deployment:

```bash
cd backend
npm ci
npm run build
npm run start:pm2
pm2 save
```

Then verify:

```bash
pm2 status
pm2 logs tripsathi-backend --lines 100
curl -i http://localhost:8080/health/live
curl -i http://localhost:8080/health/ready
sudo ss -ltnp | grep :8080
```

Important operational lessons already encountered:

- PM2 can temporarily show `online` while a crashing process repeatedly restarts. Check restart count, error logs, and the listening socket.
- A previous startup crash came from an invalid Mongoose decorator/default for `locationGps`; this was corrected. Mongoose nested object definitions must use valid schema metadata.
- A previous `ECONNREFUSED` was caused by the process not actually listening, despite the process-manager view.
- `404 Cannot GET /admin/notifications` means the running backend does not contain or register the expected controller/route, or the Admin API URL points to an older deployment. It is different from a network connection failure.
- Restart with updated environment values when deployment configuration changes.
- Put the public API behind a properly configured HTTPS reverse proxy and firewall.

## 13. Known remaining work

The project has substantial implementation, but it is not accurate to call every production concern complete.

### Priority 0 — Deploy and prove the current release

- Deploy the latest backend, Admin, and Flutter configuration to the intended environments.
- Confirm PM2 is stable with no restart loop and the expected port is listening.
- Verify the HTTPS reverse proxy, CORS, cookies, and frontend API URLs.
- Run authenticated production smoke tests for login, recovery, reports, notifications, campaign lifecycle, photo verification, map completion, and audit history.
- Verify email OTP delivery to the correct registered address and SMS delivery if enabled.
- Verify FCM on real Android/iOS devices in foreground, background, terminated state, and notification-open flows.
- Configure MongoDB backups and verify required indexes, including geospatial and audit query indexes.
- Configure monitoring token, external uptime checks, alert destination, metrics collection, and log rotation.

### Priority 1 — Data integrity and field calibration

- Backfill trusted coordinates, radius, category, and subcategory for existing places.
- Field-test geofence radii in dense urban areas, remote trails, and low-accuracy conditions.
- Add an admin correction/reversal workflow for an incorrectly approved visit without corrupting XP or map progress.
- Replace simplified Nepal geometry with authoritative machine-readable boundaries if exact polygon accuracy is required.
- Define retention and privacy handling for GPS, photos, EXIF, device tokens, reports, and audit records.

### Priority 2 — Test and release engineering

- Add broader end-to-end tests across all three applications.
- Cover report assignment/status push, notification-open refresh, OTP time boundaries, evidence approval idempotency, appeals, campaign expiry, audit events, and alert thresholds.
- Add CI gates for backend build/tests, Admin build, Flutter analyze/tests, dependency/security audit, and formatting.
- Formalize migrations/backfills for older hierarchy and evidence data.
- Test scheduler behavior under multiple backend instances or introduce distributed locking.

### Priority 3 — Product completeness and polish

- Translate all user-facing Flutter feature strings into English and Nepali, beyond the current shell/localization foundation.
- Complete a release accessibility audit with screen readers, focus order, contrast, dynamic text, semantics, and touch-target checks.
- Expand deliberate offline behavior beyond the cached-profile fallback where product requirements justify it.
- Finish Treasure Hunt end to end before restoring its navigation.
- Finish media moderation controller, routes, authorization, UI and tests before exposing it.
- Prepare user-facing privacy, community, evidence rejection/appeal, XP, and account recovery policies.

## 14. Source-of-truth files to inspect

Start with these areas rather than guessing from UI labels:

- `backend/src/main.ts`: application bootstrap, middleware, global validation and runtime behavior.
- `backend/src/app.module.ts`: registered backend modules.
- `backend/src/auth/`: authentication, OTP, verification and recovery.
- `backend/src/report/`: feedback/report contracts and moderation workflow.
- `backend/src/notification/`: notification persistence, admin feed and FCM.
- `backend/src/visited-place/`: evidence and travel completion behavior.
- `backend/src/extra/`: place hierarchy and catalog management.
- `backend/src/xp-ledger/`: XP idempotency and ledger rules.
- `backend/src/audit/`: durable audit history and querying.
- `backend/src/observability/`: structured logging, metrics and alerts.
- `backend/ecosystem.config.cjs`: PM2 process and log configuration.
- `Admin/app/` and `Admin/components/`: admin routes and interfaces.
- `Users/lib/core/`: Flutter networking, storage, localization and shared services.
- `Users/lib/features/`: traveler feature implementations.
- `README.md`: full delivery timeline and environment/deployment reference.

Before changing an API, search all backend, Admin, and Flutter call sites. This repository has multiple clients and a seemingly small contract change can break one of them.

## 15. Guidance for Claude when reviewing this project

When asked to review or suggest improvements:

- Inspect the actual current source before concluding that a feature is absent or complete.
- Clearly separate “implemented in source,” “covered by tests,” and “verified in production.”
- Prioritize account security, XP/visit integrity, data correctness, and reliable deployment over cosmetic features.
- Identify the exact file/module and evidence behind each finding.
- Avoid proposing client-only security controls.
- Avoid continuous polling where FCM, lifecycle refresh, or event-driven invalidation is sufficient.
- Preserve backward compatibility or provide an explicit migration for existing users and MongoDB documents.
- Make XP mutations idempotent and auditable.
- Treat GPS and uploaded photos as sensitive data.
- Do not expose or request committed secrets; use environment configuration.
- Do not describe simplified map geometry as authoritative.
- Do not unhide Treasure Hunt or media moderation merely because partial code exists.
- Prefer small, testable changes with an explicit verification plan.
- Preserve existing user changes in a dirty working tree.

For recommendations, use this structure:

1. Finding and concrete evidence.
2. User/security/operational impact.
3. Recommended change.
4. Exact modules likely affected.
5. Migration or compatibility risk.
6. Tests and production verification required.

## 16. Suggested review prompt

The following prompt can be given to Claude together with this repository:

> Read `CLAUDE.md` and `README.md`, then inspect the relevant source code before making claims. Review TripSathi as a production Nepal travel-gamification platform. Separate implemented, locally verified, deployed, and still-missing work. Prioritize account security, OTP/recovery safety, verified-visit anti-fraud, XP idempotency, role authorization, data migrations, notification reliability, observability, accessibility, localization, offline behavior, and production operations. For every recommendation, cite the affected local files, explain impact and risk, and propose a bounded implementation and test plan. Do not expose secrets, do not rely on client-side validation for security, and do not treat hidden partial features as complete.

## 17. Documentation maintenance rule

Update this file and `README.md` whenever a material feature, invariant, deployment requirement, known limitation, or verification result changes. Use exact dates and do not mark production work complete based only on a successful local build.
