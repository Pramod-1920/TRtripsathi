# TRTripSathi — Full Project Documentation and Development Status

**Last source review:** 2026-08-16

**Applications covered:** NestJS backend, Next.js Admin dashboard, and Flutter user app

**Documentation status:** This root README is the current project handoff and source of truth. `README_PROJECT.md` contains older audit material and may describe problems that have since been fixed.

## 1. Document purpose

This document describes the current TRTripSathi system for developers, reviewers, and AI research. It explains the product purpose, architecture, backend modules, admin capabilities, authentication, data flows, implementation status, limitations, and how to run the project.

The repository contains three applications:

| Application | Directory | Responsibility |
| --- | --- | --- |
| Backend API | `backend/` | Authentication, business rules, MongoDB persistence, gamification, trips, campaigns, moderation, and admin APIs |
| Admin dashboard | `Admin/` | Browser-based operations console for admins |
| User client | `Users/` | Flutter mobile/web client consuming the backend API |

This README covers all three applications. It describes code present in the repository; a feature marked partial or planned should not be treated as production-complete until its deployment and end-to-end flow have also been verified.

## Current delivery snapshot

| Application | Current state | Last verified |
| --- | --- | --- |
| Backend | Compiles successfully; production entry point is `dist/src/main.js` | `npm run build` and 11/11 tests, 2026-08-16 |
| Admin | Compiles and generates all current routes successfully | `npm run build`, 2026-08-15 |
| Flutter | Static analysis passes with no issues | `flutter analyze`, 2026-08-15 |

The latest work is implemented in source. A production server still needs the latest revision pulled, rebuilt, restarted, and smoke-tested before the feature should be called deployed.

## Work completed through 2026-08-16

### User-facing Flutter work

- Reorganized the Flutter client around feature-first screens, providers, shared networking, secure token storage, routing, theme, onboarding, authentication, dashboard, profile, trips, campaigns, chat, reviews, achievements, and map flows.
- Connected login, signup, refresh-token handling, logout, profile loading/editing, and role-aware session behavior to the backend.
- Added richer campaign discovery and creation, including public/private campaigns, join codes, activity category/subcategory, Nepal location selection, difficulty, scheduling, solo/group behavior, journey state, trip details, and refresh handling.
- Added explicit lifecycle handling for open, ongoing, completed, and expired journeys. Expired campaigns are excluded from the public Campaign tab and remain available in the appropriate journey/history state.
- Added a profile Report an Issue screen with a non-generic, app-consistent design, issue reason selection, validation, submission history, status labels, error states, and pull-to-refresh.
- Added efficient report-status synchronization: fetch when the report screen opens, fetch when the app resumes, retain manual pull-to-refresh, send an FCM push after an admin status change, and refresh once when the user opens or receives the relevant notification. Continuous per-user polling was intentionally avoided.
- Added Firebase Messaging initialization, Android/iOS token registration, token refresh, logout unregistration, foreground handling, notification-open routing, and Firebase environment configuration.
- Added a Nepal-only trip map with constrained Nepal framing, campaign/trip destinations, user location, map filters, destination details, and safe handling when a campaign has no valid GPS pin.
- Added Nepal visit coverage views using district boundaries and seven-province grouping. Visited districts are highlighted and counted; a province is highlighted as complete only after every district in that province has at least one verified visit.
- Added standalone place photo verification from Profile. A user selects a trusted catalog place and submits a title, category, address, photo, and a fresh high-accuracy GPS fix with province, district, and municipality context.
- Added approved-place display on the map. Admin-approved place evidence contributes to district visit counts and appears as a completed place; duplicate pending or approved evidence for the same catalog place is rejected.
- Validated the district completion registry against Nepal's National Statistics Office structure: 77 unique districts grouped 14/8/13/11/12/10/9 across the seven provinces. Added automated registry, boundary, coordinate, geometry, and spelling-alias tests. Official/common variants such as Sirah/Siraha, Kavreplanchok/Kavrepalanchowk, Nawalparasi East/Nawalpur, and Rukum East/Eastern Rukum now resolve consistently.
- Added forgot-password recovery by registered email or Nepal phone, six-digit expiring codes, password reset, and email/SMS verification for new accounts. Responses avoid account enumeration and successful reset revokes existing refresh sessions.
- Added backend-enforced onboarding completion. Flutter mirrors validation for UX, while `PATCH /user/profile/complete` is the source of truth for identity, profile photo, biography, traveler preferences, interests, and languages.

### Report, feedback, and moderation work

- Added two explicit moderation categories in one backend model and one Admin manager: `feedback` and `report`.
- Product bugs, improvement suggestions, and general experience messages use `POST /reports/feedback` and appear in the Admin Feedback section.
- Target-specific complaints about a user or trip use `POST /reports/:targetId` and appear in the Admin Reports section. Routing is determined by the endpoint and context, not by unreliable keyword or AI classification.
- Restricted report and feedback creation to accounts with the `user` role. Admins and moderators can review, assign, investigate, resolve, or dismiss items but cannot file user complaints.
- Fixed the `Reporter profile not found` failure by validating the Auth account, accepting only active user accounts, and repairing a missing companion User profile for older valid users.
- Admin/report queries filter out submissions from non-user roles, including historical invalid records.
- Added user submission history through `GET /reports/mine`.
- Added status-change database notifications and FCM delivery. The moderation update remains committed even if push delivery is temporarily unavailable.
- Hid unfinished features instead of presenting broken controls: `/treasurehunt` now redirects to the dashboard and has no navigation entry; Media Moderation remains unlisted because its service/component prototypes do not yet have a complete controller, authorization, page, and tested workflow.
- Added immediate local Admin report updates plus silent eight-second/focus revalidation, so investigating/resolved/dismissed changes appear without a full browser reload and concurrent moderator changes are picked up.

### Admin dashboard work

- Added a unified Notifications item to both the top navigation and sidebar, including an unread badge and a dedicated `/notifications` page.
- The Admin notification feed combines new user reports/feedback, campaign creation, and photo-verification requests. It refreshes on page focus and every 30 seconds for the small admin audience, and supports mark-all-read state per admin.
- Added/expanded report management with Feedback and Reports views, totals, status statistics, reason labels, assignment, resolution notes, and live table/detail updates.
- Added campaign creation, detail, approval, rejection, lifecycle, review, deleted-bin, restore, and permanent-delete screens.
- Added user administration, profile detail, progression, XP history/correction, achievements, badges, campaign quota, and visited-place management.
- Added photo-verification queue review with user/place evidence, GPS distance/accuracy, appeal context, approve/reject actions, and mandatory rejection reasons.
- Added analytics, chat, reviews, weather/geocoding preview, activity, difficulty, XP, level-up, badge, achievement, and place administration.
- Expanded Places into a four-level Nepal hierarchy: Province → District → Municipality → Place.
- Made missing `municipalities` and `places` arrays normalize to empty arrays, preventing the Admin `municipality.places.length` crash with older hierarchy data.
- Added place activity category and dependent subcategory selection plus trusted latitude, longitude, and configurable verification radius. New places require this trust metadata; existing places can be backfilled in the editor.

### Backend and data work

- Added four-level Nepal place hierarchy DTOs, normalization, duplicate validation, add/rename/disable/restore/hard-delete operations, bulk seeding, caching, and active/deleted views.
- Added public place catalog results with municipality and place category/subcategory metadata.
- Added visited-place persistence with normalized district/province codes, visit counts, campaign-source idempotency, user summary responses, and Admin add/remove support.
- Campaign completion verification records district/province visits and feeds XP, exploration, achievement, and map progress.
- Standalone evidence is checked against the active catalog, a fresh GPS timestamp/accuracy, a server-calculated Haversine geofence, the configured Cloudinary account, size/type limits, and exact SHA-256 duplicate fingerprints before review.
- Standalone approval awards a fixed 40 XP once per canonical District + Municipality + Place using an atomic ledger context key. It records idempotent district/province visits; campaign evidence continues to use configured solo/group XP events.
- Added one user appeal per rejected photo request. Rejections require an actionable reason and approval revalidates current catalog coordinates/radius.
- Added campaign GPS support using a GeoJSON `Point` and sparse `2dsphere` index.
- Fixed Mongoose startup failure `Invalid value for schema path locationGps.default` by defining `CampaignLocationGps` as an explicit nested schema.
- Added scheduled campaign lifecycle housekeeping and server/client filtering so expired campaigns do not remain in active discovery.
- Added user push-token storage, database notifications, FCM multicast delivery, and invalid-token cleanup.
- Added Phase 4 observability: newline-delimited JSON logs with secret-field redaction, separate liveness and dependency-readiness endpoints, protected bounded process/HTTP metrics, consecutive-5xx webhook alerts, and a single combined PM2 log file.
- Added searchable Admin audit history. Report status/assignment, place hierarchy changes, photo-verification decisions, campaign moderation, and existing sensitive Admin actions are recorded with timestamps and actor identifiers in MongoDB, mirrored to append-only JSONL, and optionally shipped to S3. Existing JSONL history is imported idempotently at startup.
- Added Flutter English/Nepali localization foundations with a persisted language switch, screen-reader live offline announcements, explicit request timeouts/network state, and encrypted last-profile fallback for read-only offline display.
- Added a Firebase Admin compatibility adapter so messaging can work with supported modular or legacy package exports instead of failing on unavailable `firebase-admin/app` or `firebase-admin/messaging` TypeScript paths.
- Added unified Admin notification APIs at `GET /admin/notifications` and `PATCH /admin/notifications/read`.
- Corrected the production start path to `node --enable-source-maps dist/src/main.js`, matching the Nest build output and improving PM2 stack traces.
- Made the dedicated XP ledger authoritative for award idempotency with a unique per-user context key. Award retries recover unfinished reservations and the user XP/history mutation is atomic.
- Made photo-verification review transitions atomic. Concurrent approvals claim a pending request once, same-decision retries safely reconcile side effects, and conflicting later decisions are rejected.

## Recent development timeline

| Date | Delivered work |
| --- | --- |
| 2026-08-06 | Baseline Admin documentation, user/report foundations, XP history administration, and initial Flutter screens/providers |
| 2026-08-07 | Admin design and user-management expansion, campaign screens, analytics, photo queue, chat/reviews, and activity subcategories |
| 2026-08-08 | Backend/Admin container and Docker Compose setup plus dependency/security integration work |
| 2026-08-09 | Production backend URL configuration, Flutter secure/network integration, campaign journey organization, user progression, XP, visits, and badge management |
| 2026-08-12 | Campaign creation/lifecycle improvements, trip detail screen, campaign/trip card interaction, and user journey updates |
| 2026-08-15 | Feedback/report rules, live status/FCM/Admin notifications, expired-campaign filtering, Nepal map/coverage, trusted Places, secure verification/recovery, backend profile completion, GPS geofencing, duplicate checks, appeals, standalone XP idempotency, compatibility fixes, and PM2 correction |
| 2026-08-16 | Ledger-backed XP idempotency, recoverable award reservations, atomic photo-review transitions, and concurrency regression coverage |

## Important behavior decisions

### Feedback versus report routing

| User action | Stored category | Admin destination |
| --- | --- | --- |
| Report an app bug | `feedback` | Feedback |
| Suggest a feature/improvement | `feedback` | Feedback |
| Share general product feedback | `feedback` | Feedback |
| Report a specific user | `report` | Reports |
| Report a specific trip/campaign safety or conduct problem | `report` | Reports |

Only a normal user can create either category. Admin and moderator roles are operational roles for reviewing and resolving the queue.

### Report refresh strategy

The Flutter app does not continuously fetch report status for every signed-in user. It fetches on screen open, app resume, manual refresh, and a relevant FCM event. This keeps status reasonably current without multiplying database and CPU work as the user base grows.

### Map and visit completion rules

- A verified district visit highlights that district and increases its count.
- Repeated verified visits increase the district count without creating duplicate campaign awards.
- A province is shown complete only when all mapped districts in that province have at least one verified visit.
- Place photo evidence is not accepted merely because the user typed a location; the selected place must exist in the active Admin-managed Nepal catalog.
- The server requires a fresh GPS fix within the Admin-configured place radius. Exact-byte duplicate detection is active; perceptual similarity and device attestation remain future defenses.

### Account and onboarding trust rules

- New accounts must verify either their registered email or Nepal phone before submitting place evidence.
- OTPs contain exactly six digits and expire after 3 minutes. They have a 60-second resend cooldown, five attempts, and five requests per account/purpose/hour. Only HMAC digests are stored.
- Forgot-password uses a uniform response shape for known and unknown identifiers. Successful reset verifies that contact, clears lockout state, and revokes refresh sessions.
- Legacy accounts remain usable through the migration-safe `verificationRequired=false` default; changing a contact makes verification required again.
- Profile completion is calculated by the backend. Partial edits no longer incorrectly mark onboarding complete.
- Traveler experience/“Explorer identity” persists as `travelerExperience`; signup does not promise XP that lacks a transactional backend event.

## Remaining work

### Priority 0 — deployment and production verification

- Pull/deploy the latest backend and Admin revision on Ubuntu, run clean production builds, restart PM2 with updated environment variables, and confirm the restart counter remains stable.
- Verify the backend listens on `127.0.0.1:8080`/the configured interface and that the reverse proxy, cloud firewall, and OS firewall expose only the intended HTTPS API route.
- Smoke-test `/admin/notifications?limit=50` after deployment. A `404` means the server is still running an older build that does not include `AdminNotificationController`.
- Configure Firebase service-account credentials on the backend and valid public Firebase app identifiers in Flutter; test foreground, background, terminated-app, token rotation, and notification-open behavior on real Android and iOS devices.
- Configure production HTTPS. Flutter release builds intentionally reject an HTTP backend URL.
- Verify MongoDB indexes, including the campaign `2dsphere` index, against existing production data before rollout.
- Back up the production database before hierarchy/data migrations and verify restore procedures.

### Priority 1 — production-hardening the new trust flows

- Backfill category/subcategory values for existing place records through the Admin Places editor.
- Decide whether choosing a place during campaign creation should automatically preselect that place's activity category/subcategory.
- Replace the simplified visual district polygons with a licensed Survey Department machine-readable dataset if cartographic/legal precision is required. Administrative completion no longer depends on trusting those polygon shapes: the separately tested NSO-aligned registry is the source of truth.
- Backfill trusted latitude/longitude/radius data for every place that should accept evidence and field-check radii at dense urban, rural, and large natural sites.
- Configure Resend and/or Twilio production credentials, verified sender identities, delivery monitoring, and templates; exercise both recovery channels on real devices.
- Add perceptual-image similarity and risk-based device attestation if fraud volume justifies it. Current SHA-256 catches exact-byte reuse only.
- Add an Admin workflow for correcting an incorrectly approved place visit without corrupting XP history or map counts.

### Priority 2 — testing and reliability

- Add end-to-end tests for user-only complaint creation, feedback/report routing, missing-profile repair, Admin/moderator status permissions, and FCM failure tolerance.
- Add integration tests for the Admin notification feed, unread state, campaign creation events, photo queue events, and report events.
- Add campaign lifecycle clock-boundary tests so expiry behavior remains correct across timezone and scheduler conditions.
- Add photo-verification tests for invalid, ambiguous, duplicate, pending, approved, rejected, and deleted catalog places.
- Add map/widget tests for unpinned destinations, district counts, province completion, approved-place markers, and empty/error states.
- Add database migration/versioning for stored JSON place hierarchies instead of relying only on runtime normalization.
- Finish CI gates for backend build/tests, Admin build/lint, Flutter analyze/tests, dependency audit, and merge-marker detection.

### Priority 3 — product and operations backlog

- Add high-risk contact-change confirmation that verifies both the old and new email/phone.
- Finish and verify treasure-hunt Admin coverage and decide whether legacy media moderation should be exposed or removed.
- Complete chat moderation policy, pagination/load testing, reporting entry points, blocking, and abuse controls.
- Formalize production Redis, distributed rate limiting, single-run scheduler coordination, backups, retention, and incident response. Structured logs, health/readiness, metrics, and alert hooks are implemented but still require production monitoring credentials and dashboards.
- Expand English/Nepali translations from the application shell into every feature-specific sentence as product copy stabilizes; keep semantic labels and large-text testing in the release checklist.

## 2. Product overview

TRTripSathi is a travel and exploration platform intended to let users discover places, create or join trips and campaigns, upload evidence, communicate with other travelers, earn XP, unlock levels/badges/achievements, and build a travel profile.

The admin side gives authorized staff control over users, campaign approval, content and media moderation, Nepal place data, activities, difficulty rules, XP rules, level-up rules, badges, achievements, reviews, reports, and operational analytics.

## 3. Technology and architecture

### Backend

- NestJS 11 and TypeScript
- MongoDB through Mongoose
- JWT access and refresh authentication
- HTTP-only cookies plus bearer-token support
- Role-based authorization (`admin`, `moderator`, `user`)
- Cloudinary signed media uploads
- Redis integration for revocation/rate-limiting support
- Swagger/OpenAPI at `/api/docs`
- Helmet, CSRF protection, request validation, request logging, and rate limiting
- Scheduled campaign lifecycle processing

### Admin

- Next.js 16 and React 19
- TypeScript, Tailwind CSS, Lucide/react-icons, Recharts
- Axios API client with credentials, CSRF header support, and token-refresh retry logic
- Zustand session store
- Route pages under `Admin/app/` and reusable managers under `Admin/components/`

### Runtime flow

```text
Admin browser / Flutter client
        |
        v
Next.js API client or Flutter HTTP client
        |
        v
NestJS controllers -> guards/validation -> services -> Mongoose schemas -> MongoDB
        |
        +-> Redis (revocation/rate limiting where configured)
        +-> Cloudinary (images and media)
        +-> Firebase Cloud Messaging (report-status push delivery)
```

Default local addresses:

| Service | URL |
| --- | --- |
| Backend | `http://localhost:8080` |
| Admin | `http://localhost:3000` |
| Flutter web | `http://localhost:8081` |
| Swagger | `http://localhost:8080/api/docs` |

## 4. Backend modules and implemented functions

### Authentication and authorization (`auth`)

Implemented:

- Phone-number/password signup and login
- Password hashing with bcrypt
- Access-token and refresh-token generation
- HTTP-only `access_token` and `refresh_token` cookies
- Bearer-token authentication for API clients
- Refresh-token rotation/revocation using a stored hash
- Logout and token revocation
- Current-user endpoint (`GET /auth/me`)
- Admin-only authorization through roles guards
- Failed-login tracking and account lockout behavior
- Auth endpoint rate limiting
- DTO validation for passwords and phone numbers

Main endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/admin-only`.

### Users and profiles (`user`)

Implemented:

- Profile creation and editing
- Name, age, email, phone, location, province, district, landmark, bio, profile photo, and experience data
- Profile-completion state
- Public/user search and profile lookup
- User XP history and XP event triggering
- Achievement event triggering
- Referrer assignment and ratings
- Photo-verification request creation
- Admin user listing, search, detail view, profile editing, and deletion
- Admin XP add/simulation/history edit/history delete
- Admin achievement event triggering
- Admin campaign quota updates
- Admin photo-verification review

Main route groups: `/user/profile`, `/user/search`, `/user/:id`, `/user/xp/events`, `/user/achievements/events`, `/user/photos/verification-requests`, and `/user/admin/...`.

### XP, levels, ranks, achievements, and badges

The gamification system is driven mainly by user services and configurable `Extra` records.

- XP event processing and XP ledger/history
- Rule-based XP values and repeat policies
- Conditions for difficulty, activity, district, host status, solo/group status, ratings, and exploration
- Level calculation from total XP
- Rank progression from level
- Rank progress and next-rank information in profile/XP responses
- Achievement progress and reward XP
- Rank-up achievement support
- Admin manual XP corrections with a reason
- Configurable rank badge definitions

The repository also contains dedicated `achievement`, `badge`, and `xp-ledger` modules. The active admin configuration path is primarily `Extra` plus `UserService`.

Default rank bands currently represented by the backend are `F`, `E`, `D`, `C`, `B`, `A`, `S`, `SS`, `SSS`, `Mythic`, and `Heroic`.

### Extra configuration (`extra`)

`Extra` is the admin-configurable catalog for system rules and supporting data. Categories include:

- `places`: provinces, districts, municipalities, place titles, and place activity metadata
- `activities`: campaign/activity types
- `difficulty`: difficulty definitions and approval/XP behavior
- `xp`: XP event rules
- `level-up`: level and progression requirements
- `badge`: rank badge definitions and images
- `achievement`: achievement definitions and reward configuration

Implemented admin operations include create, list, detail, update, delete, four-level place hierarchy retrieval, bulk place seeding, place category/subcategory editing, and difficulty management. Place seed data is available in `backend/nepal_province_district.json`.

### Trips (`trip`)

Implemented:

- Authenticated trip creation, listing, detail, and updates
- Trip deletion restricted to admins
- Joining trips
- Participant listing
- Check-in
- Admin participant approval
- Admin completion confirmation

### Campaigns (`campaign`)

Campaigns are the main planned travel/activity workflow.

Implemented:

- Campaign creation and editing
- Solo and group hike types
- Scheduled and instant campaign behavior where allowed
- Location, activity, difficulty, duration, cost, participant limit, photos, and join-mode data
- Open-join and request-join flows
- Campaign listing and detail retrieval
- Joining, leaving, and confirming participation
- Participant role changes
- Planning data and task creation/editing
- Phase transitions
- Submit, approve, reject, and verification workflows
- Campaign completion/verification and XP-related lifecycle hooks
- Admin soft-delete to a bin, restore, and permanent delete
- Scheduled lifecycle processing
- GeoJSON campaign coordinates and map-safe handling for campaigns without coordinates
- Active discovery filtering that excludes expired campaigns
- Verified completion recording for district/province visit progress

Main route family: `/campaigns`.

Important rules currently enforced include date ordering, join-window checks, approval status, participant limits, duplicate participation prevention, and restrictions on non-admin instant campaigns.

### Reviews, reports, and moderation

Reviews (`review`) support:

- Rating a participant/user after a trip
- User review lists and statistics
- Reviews given by a user
- Trip review lookup
- Admin review listing, editing, and deletion

Reports (`report`) support:

- User-only product feedback and target-specific user/trip reporting
- Deterministic Feedback versus Reports routing by endpoint/context
- Automatic repair of a missing companion profile for an otherwise valid user account
- Current-user submission history
- Open/all report queues
- Report statistics
- Reports by target
- Assigned reports
- Admin assignment
- Admin/moderator status updates
- Database and FCM notification after a status change

Media (`media`) supports media records and moderation flows, including pending media, moderation statistics, approval, and rejection. User photo verification is handled through user endpoints and the admin photo queue.

### Chat (`chat`)

Implemented chat functions include:

- Person-to-person conversations
- General groups and campaign groups
- Conversation listing and unread counts
- Group detail, add/remove member, and leave group
- Message send, list, edit, delete, mark-read, search, and unread-count operations

### Notifications (`notification`)

Implemented:

- User notification listing
- Unread notification listing and count
- Mark one notification read
- Mark all notifications read
- Delete notification
- Android/iOS FCM device-token registration and removal
- Report-status push delivery and notification-open routing
- Admin unified feed for reports/feedback, campaign creation, and photo verification
- Admin unread state and mark-all-read behavior

### Visited places and Nepal map (`visited-place`)

Implemented:

- Verified district and province visit persistence with counts
- Campaign-source idempotency
- Current-user visit summary and approved standalone-place evidence
- Admin list, record, and remove operations
- Flutter Nepal-only destinations and coverage views
- District highlighting/counts and seven-province completion rules

### Treasure hunts (`treasure-hunt`)

The backend contains a treasure-hunt module for admin hunt creation and authenticated retrieval/progress flows, including hunt lookup by ID and trip association. The admin navigation currently does not expose a complete treasure-hunt management screen, so this area should be considered backend-supported but admin UI coverage is limited.

### Cloudinary and media uploads

Authenticated clients can request Cloudinary upload signatures through `POST /cloudinary/signature`. Admin campaign, badge, and profile screens use signed/direct upload flows for images. Credentials remain server configuration and must not be committed.

### Admin utilities and weather

The backend includes an admin module with weather/geocoding support used by place-management screens. These integrations depend on the external service configuration and network availability.

## 5. Backend security and request behavior

The application currently includes:

- Global `ValidationPipe` with whitelist and non-whitelisted-field rejection
- Global exception formatting through `HttpExceptionFilter`
- CORS configured from comma-separated `FRONTEND_URL`
- Credentials enabled for cookie authentication
- Helmet security headers
- CSRF double-submit cookie protection for state-changing requests
- Auth rate limits: five requests/minute and twenty requests/hour for key auth routes
- Admin security headers middleware
- Request logging middleware
- JWT guards and role guards
- Refresh-token revocation service

Production requirements still include HTTPS, strong unique secrets, a production Redis strategy, credential rotation, startup environment validation, and monitoring.

## 6. Admin dashboard capabilities

### Authentication and session behavior

The admin portal provides:

- Admin login at `/login`
- Cookie-based session handling
- `GET /auth/me` session validation
- Automatic access-token refresh after a 401 response
- CSRF token attachment for state-changing requests
- Rejection/redirect of non-admin users
- Logout and inactivity/session cleanup

### Navigation and pages

| Admin area | Current capability |
| --- | --- |
| Dashboard | User/profile overview and high-level operational statistics |
| Users | Paginated user list, search/filtering, profile detail, editing, deletion, XP history, XP correction, and achievements |
| Notifications | Unified reports/feedback, campaign creation, and photo-verification feed with unread count |
| Reports | Separate Feedback and Reports queues, statistics, assignment, status, and resolution management |
| Photo Queue | Review and approve/reject campaign or standalone-place photo-verification requests and award configured XP on approval |
| Analytics | User growth/profile data plus campaign totals, upcoming/ongoing/open counts, participants, average duration, and top hosts |
| Campaign Add | Create campaign with activity/place/difficulty data, scheduling, participants, media, and campaign rules |
| Campaign Details | View/edit campaign details, participants, planning, tasks, media, and lifecycle actions |
| Campaign Approval | Review submitted campaigns and approve/reject them |
| Campaign Bin | Review deleted campaigns, restore them, or permanently delete them |
| Campaign Reviews | View, update, and delete reviews |
| My Campaign | View campaigns available to the admin user and join where applicable |
| Places | Manage Province → District → Municipality → Place, including place activity category/subcategory and disabled records |
| Difficulty | Configure difficulty records and approval behavior |
| Activities | Manage activity/extra records used by campaigns |
| XP | Manage XP rules and simulate XP behavior |
| Badge | Manage rank badges and assign badges to profiles |
| Level Up | Manage level-up and progression requirements |
| Achievements | Create, edit, list, and delete achievement definitions |
| Chat | View conversations/messages and search messages |
| Treasure Hunt | Intentionally hidden; the old `/treasurehunt` URL redirects to Dashboard until user and Admin workflows are complete |

## 7. Main admin workflows

### New admin setup

1. Start backend and Admin.
2. Log in with an account whose backend role is `admin`.
3. Configure `Extra` data in this order: Places, Activities, Difficulty, XP, Level Up, Badge, Achievement.
4. Review users and photo-verification requests.
5. Review submitted campaigns from Campaign Approval.

### Campaign lifecycle

```text
Create -> Submit -> Admin approve/reject -> Join/request -> Plan/tasks
       -> Campaign window -> Completion/photo verification -> XP/achievement updates
       -> Completed or failed -> Bin/restore/permanent delete (admin)
```

### XP lifecycle

```text
User/admin event -> XP rule matching -> XP ledger -> level/rank calculation
                 -> achievement progress -> reward XP/rank badge visibility
```

## 8. Data model areas

MongoDB schemas currently cover:

- Auth accounts and refresh-token state
- User profiles
- Trips and trip participants
- Campaigns and campaign participants
- Extra configuration/catalog records
- XP ledger/history
- Achievements and rank-up achievements
- Badges
- Reviews
- Reports
- Notifications
- Chat groups and messages
- Visited places
- Treasure hunts and user treasure progress
- Media and photo-verification records

Profiles are separate from authentication records and are linked through `authId`.

## 9. What is built and ready

### Implemented and connected

- Backend compiles through `npm run build`.
- Admin login/session integration is connected to backend auth.
- User/profile administration is connected to backend APIs.
- Campaign creation, listing, details, approval, bin, restore, and lifecycle screens are connected.
- Extra configuration screens are connected for places, difficulty, activities, XP, badges, level-up rules, and achievements.
- Photo-verification queue is connected.
- Flutter Report an Issue, user report history, Admin Feedback/Reports queues, status updates, and event-driven refresh are connected.
- User FCM token registration and report-status push paths are implemented; delivery still depends on correct Firebase deployment configuration.
- Admin notifications are connected in the header, sidebar, and dedicated notification page.
- Nepal-only map, destination markers, district/province coverage, visit counts, and approved-place evidence are connected.
- Four-level Places management and place category/subcategory metadata are connected.
- Expired campaigns are excluded from active Flutter campaign discovery.
- Analytics page calculates current user and campaign metrics from available API data.
- Backend Swagger documentation is generated from controllers.
- Flutter client has authentication/profile flows that use the same backend.

### Implemented but should be treated as operational/partial

- Treasure Hunt backend foundations remain in source, but the feature is intentionally hidden until a complete user journey and Admin management workflow are implemented and tested.
- Media moderation schema/service and an unused component prototype remain in source, but there is no complete HTTP controller or Admin route. It is intentionally absent from navigation until authorization, endpoints, page integration, and tests are finished.
- Chat admin UI exists, but full moderation policy and pagination behavior should be tested.
- Redis-backed distributed rate limiting is not guaranteed; an in-memory limiter is used in the bootstrap path.
- External geocoding/weather and Cloudinary flows depend on credentials and network services.
- FCM push delivery depends on backend service-account credentials, mobile Firebase identifiers, native Firebase configuration, and OS notification permission.
- The Nepal administrative registry is validated for all 77 districts and seven province assignments. The displayed polygons are simplified third-party visual geometry, not an authoritative cadastral/legal layer; GPS/place anti-fraud still requires field verification.

## 10. Known limitations and unfinished work

- Verification/recovery code delivery depends on production Resend/Twilio credentials, sender approval, and real-device delivery testing.
- Legacy accounts are intentionally not forced through verification until their contact changes; plan a staged migration if all existing accounts must be verified.
- Exact-image hashing cannot find cropped, recompressed, screenshot, or visually similar evidence; see `backend/PHOTO_VERIFICATION_POLICY.md`.
- The Flutter profile screen is still partly a profile/dashboard hybrid; a dedicated user home dashboard remains future work.
- Existing places may not yet have category/subcategory or trusted coordinate/radius metadata and require an Admin backfill before accepting evidence.
- A server geofence materially improves presence evidence but cannot by itself defeat OS-level GPS spoofing on a compromised device.
- Admin notifications currently use focus refresh plus a 30-second interval; this is acceptable for a small staff audience but should be measured before the Admin user count grows.
- Automated end-to-end coverage for auth, campaign lifecycle, XP idempotency, media, and admin operations is incomplete.
- Existing lint/analyzer debt remains in parts of Admin and Flutter.
- Production deployment, secrets management, backup/restore, health checks, observability, and CI need formalization.

## 11. Environment configuration

Create `backend/.env` with real local or deployment values:

```env
PORT=8080
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@HOST/tripsathi
JWT_SECRET=replace_me
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PASSWORD_PEPPER=replace_with_a_long_random_secret
AUTH_OTP_SECRET=replace_with_at_least_32_random_characters
email=your-gmail-address@example.com
email_app_password=your_google_app_password
AUTH_EMAIL_FROM=TripSathi <security@example.com>
RESEND_API_KEY=replace_me
TWILIO_ACCOUNT_SID=replace_me
TWILIO_AUTH_TOKEN=replace_me
TWILIO_FROM_PHONE=replace_me
FRONTEND_URL=http://localhost:3000,http://localhost:8081
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
FIREBASE_PROJECT_ID=replace_me
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Instead of the three Firebase variables, the backend may use `GOOGLE_APPLICATION_CREDENTIALS` pointing to an absolute Firebase service-account JSON path. Keep service-account credentials on the backend only.

Create `Admin/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Never commit real passwords, JWT secrets, Cloudinary credentials, or production URLs.

## 12. Running locally

### Backend

```powershell
cd backend
npm install
npm run start:dev
```

Useful commands:

```powershell
npm run build
npm test
npm run test:e2e
npm run seed:places
npm run seed:xp
```

### Admin

```powershell
cd Admin
npm install
npm run dev
```

Open `http://localhost:3000`.

### Flutter client

```powershell
cd Users
flutter pub get
flutter run --dart-define="BACKEND_URL=http://localhost:8080"
```

For Android with FCM, copy `Users/.env.example` to the ignored `Users/.env`, fill in the public Firebase application identifiers and backend URL, then use `Users/run-android.ps1`. Release builds must use an HTTPS backend URL.

### Ubuntu/PM2 backend deployment

```bash
cd ~/tripsathi/TRtripsathi/backend
npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

For a first start:

```bash
pm2 start ecosystem.config.cjs --update-env
pm2 save
```

Verify the process is listening instead of trusting PM2's transient `online` label:

```bash
pm2 status
pm2 logs tripsathi-backend --lines 50
tail -f logs/backend.log
sudo ss -ltnp | grep :8080
curl -i http://127.0.0.1:8080/
```

The PM2 configuration merges standard output and standard error into one file:
`backend/logs/backend.log`. It contains Nest startup messages, HTTP requests,
warnings, exceptions, scheduler output, and startup crashes. The log directory
also contains older development, startup, authentication-test, and audit log
files so no `.log` files are scattered through the backend root. It is ignored
by Git. Configure PM2 log rotation or an OS `logrotate` rule in
production so this combined file cannot grow without a limit.

### Health, monitoring, and alert configuration

```env
# Required in production before a monitoring system can read /health/metrics.
MONITORING_TOKEN=replace-with-a-long-random-secret

# Optional Slack-compatible/custom webhook for operational alerts.
ALERT_WEBHOOK_URL=https://monitoring.example.com/hooks/tripsathi
ALERT_5XX_THRESHOLD=5
ALERT_COOLDOWN_MS=300000
```

Monitoring endpoints:

```bash
# Process is alive; does not depend on MongoDB.
curl -i http://127.0.0.1:8080/health/live

# Dependency readiness; returns HTTP 503 while MongoDB is unavailable.
curl -i http://127.0.0.1:8080/health/ready

# Bounded request, latency, error, uptime, and memory metrics.
curl -H "x-monitoring-token: $MONITORING_TOKEN" \
  http://127.0.0.1:8080/health/metrics
```

Configure the load balancer against `/health/ready`, an uptime monitor against
`/health/live`, and alert on readiness failure, consecutive 5xx alerts, growing
PM2 restarts, high memory, and sustained request latency. Structured application
logs are newline-delimited JSON in `logs/backend.log`; URL query strings and
sensitive object keys such as passwords, tokens, cookies, secrets, and OTPs are
not written to structured request logs.

A growing PM2 restart count with no listener means startup is crashing before Nest binds the port. The previously observed `locationGps.default` Mongoose crash has been fixed in source; seeing it again means an old backend revision/build is deployed.

## 13. AI research handoff prompt

Use the following context when asking another AI to research or extend this project:

> TRTripSathi is a full-stack travel-engagement platform. The NestJS backend in `backend/` is the source of truth for authentication, users/profiles, trips, campaigns, campaign participants, four-level Nepal places, activity metadata, difficulty, XP, levels, ranks, achievements, badges, reviews, feedback/reports, notifications/FCM, chat, photo verification, visited places, and treasure hunts. MongoDB is accessed through Mongoose. Authentication uses JWT access/refresh cookies, bearer-token support, CSRF protection, validation, rate limiting, and role guards. The Next.js Admin dashboard in `Admin/` provides operational screens including unified notifications, Feedback/Reports, photo verification, campaigns, users, analytics, and Extra configuration. The Flutter client in `Users/` provides user journeys, event-driven report status, Nepal map coverage, and standalone catalog-place evidence. Before proposing changes, inspect the actual controllers, DTOs, services, schemas, Flutter API calls, and Admin API calls. Treat the “implemented but partial” and “known limitations” sections as constraints. Use Swagger at `/api/docs` for the generated API contract and distinguish source implementation from deployment verification and production readiness.

## 14. Source-of-truth locations

- Backend composition: `backend/src/app.module.ts`
- Backend bootstrap/security: `backend/src/main.ts`
- Backend controllers/services/schemas: `backend/src/<module>/`
- Admin routes: `Admin/app/`
- Admin reusable managers: `Admin/components/`
- Admin API helpers: `Admin/lib/`
- Flutter feature code: `Users/lib/features/`
- Flutter networking and FCM: `Users/lib/core/networking/` and `Users/lib/core/notifications/`
- Firebase backend setup: `backend/FIREBASE_SETUP.md`
- Authentication notes: `backend/src/auth/AUTH_README.md`
- Seed scripts: `backend/scripts/`
- Admin-specific guide: `Admin/README.md`
