# TRTripSathi Project Guide

Last reviewed from the repository source: **2026-08-06**

This is the authoritative technical and operational guide for the TRTripSathi backend and Admin frontend. It documents what the current code does, how the applications communicate, how to run and verify them, the main problems currently present, and the security tests required before production release.

> Security note: the vulnerability section is a test and remediation checklist, not a claim that every listed risk is exploitable. Perform security testing only against systems and accounts you own or are explicitly authorized to test.

## 1. Current repository status

### Critical release blocker: unresolved merge conflicts

The repository currently contains Git conflict markers such as `<<<<<<< HEAD`, `=======`, and `>>>>>>>` inside executable source files. The Admin application does not compile until these are resolved.

Affected Admin files found during this review:

- `Admin/app/layout.tsx`
- `Admin/app/layout-wrapper.tsx`
- `Admin/app/dashboard/page.tsx`
- `Admin/app/users/page.tsx`
- `Admin/app/users/[id]/page.tsx`

Affected Flutter files include:

- `Users/lib/main.dart`
- `Users/lib/services/api.dart`
- `Users/lib/providers/auth_provider.dart`
- `Users/lib/screens/auth_login.dart`
- `Users/pubspec.yaml`
- `Users/pubspec.lock`

Find every conflict marker with:

```powershell
rg -n '^(<<<<<<<|=======|>>>>>>>)' Admin backend Users
```

Do not deploy, build a release, or run dependency upgrades until each conflict is resolved deliberately and the intended branch behavior is retained.

### Verification status on 2026-08-06

| Check | Result | Meaning |
| --- | --- | --- |
| Backend TypeScript | Passed | `npx tsc -p tsconfig.build.json --noEmit` completed successfully |
| Admin TypeScript | Failed | Merge-conflict markers cause parser and JSX errors |
| Admin dependency audit | Failed policy threshold | 16 vulnerable packages reported: 10 high, 4 moderate, 2 low |
| Backend dependency audit | Failed policy threshold | 12 vulnerable packages reported: 7 high, 3 moderate, 2 low |
| Flutter | Not treated as buildable | Conflict markers exist in Dart and package files |

Audit counts describe installed dependency advisories. They do not prove that every advisory is reachable in this application, but all direct high-severity dependencies must be upgraded or formally assessed before release.

## 2. Repository map

| Directory | Application | Purpose |
| --- | --- | --- |
| `backend/` | NestJS API | Authentication, profiles, campaigns, trips, moderation, gamification, chat, notifications, database access, and admin APIs |
| `Admin/` | Next.js Admin frontend | Browser interface for authorized administrators |
| `Users/` | Flutter client | User-facing mobile/web client |
| `README.md` | Older project overview | Useful historical context, but parts are stale |
| `Admin/README.md` | Older Admin guide | Contains removed Admin gamification references and must not be treated as current |
| `README_PROJECT.md` | This document | Current project-level source of truth |

This document focuses on `backend/` and `Admin/`. Flutter integration is included where it affects authentication, APIs, deployment, or security.

## 3. Product overview

TRTripSathi is a travel and exploration platform. Users can create accounts and profiles, discover places, create or join trips and campaigns, participate in campaign planning, upload photo evidence, review other participants, chat, receive notifications, and progress through the backend XP/achievement system.

Administrators use the Admin frontend to:

- authenticate with an admin account;
- view operational dashboard data;
- list, search, filter, edit, deactivate, and permanently delete users;
- review campaign photo-verification requests;
- review reports and moderation statistics;
- inspect analytics;
- create and manage campaigns;
- approve, reject, verify, bin, restore, and permanently delete campaigns;
- manage campaign reviews;
- manage places, activities, and difficulty settings;
- update their own Admin profile.

Admin XP, rank, badge, level-up, achievement, and leaderboard screens were removed from the active Admin navigation and route tree. The backend user gamification system still exists for user progression and confirmed backend events. Legacy unreferenced Admin gamification components may still exist under `Admin/components/`; they are not active product routes and should be deleted after conflict resolution if they are no longer needed.

## 4. Architecture

### Technology stack

Backend:

- NestJS 11 and TypeScript;
- MongoDB with Mongoose;
- JWT access and refresh tokens;
- Passport guards for authentication;
- role-based access control;
- bcrypt password and refresh-token hashing;
- Redis support for rate limiting and token security infrastructure;
- Cloudinary signed uploads;
- Swagger/OpenAPI in non-production environments;
- scheduled campaign lifecycle processing.

Admin frontend:

- Next.js 16 App Router;
- React 19 and TypeScript;
- Tailwind CSS;
- Axios with cookies and CSRF headers;
- Zustand in-memory session state;
- Recharts and icon libraries.

User frontend:

- Flutter/Dart;
- secure token storage;
- Provider state management;
- HTTP API client;
- environment-based backend URL.

### Request flow

```text
Admin browser or Flutter client
        |
        v
HTTP request with cookie or bearer token
        |
        v
NestJS middleware
  - CORS
  - Helmet/security headers
  - cookie parser
  - 64 KB JSON/form body limit
  - auth endpoint rate limits
  - CSRF validation for cookie-authenticated mutations
  - request logger
        |
        v
Controller -> authentication/role guards -> DTO validation
        |
        v
Service business rules -> Mongoose -> MongoDB
        |
        +-> Redis where configured
        +-> Cloudinary for media
        +-> external weather/geocoding providers
```

### Main source-of-truth files

- Backend composition: `backend/src/app.module.ts`
- Backend bootstrap/security: `backend/src/main.ts`
- Authentication: `backend/src/auth/`
- User/profile logic: `backend/src/user/`
- Campaign lifecycle: `backend/src/campaign/`
- Admin application routes: `Admin/app/`
- Admin API client: `Admin/lib/api.ts`
- Admin session gate: `Admin/app/layout-wrapper.tsx`
- Admin navigation: `Admin/components/sidebar.tsx`

## 5. Local setup

### Prerequisites

- Node.js version supported by NestJS 11 and Next.js 16;
- npm;
- MongoDB instance;
- Redis for production-like rate limiting;
- Cloudinary account for upload flows;
- Flutter SDK and Android/iOS tooling only when testing `Users/`;
- Git and `rg` (ripgrep) for repository checks.

### Step 1: resolve source conflicts

Choose the correct side of every merge conflict. Never remove markers mechanically without reviewing both alternatives. Then run:

```powershell
rg -n '^(<<<<<<<|=======|>>>>>>>)' Admin backend Users
```

Expected result: no output.

### Step 2: backend environment

Create `backend/.env`:

```env
NODE_ENV=development
PORT=8080
FRONTEND_URL=http://localhost:3000,http://localhost:8081
MONGODB_URI=mongodb://127.0.0.1:27017/trtripsathi
MONGODB_CONNECT_TIMEOUT_MS=5000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
JWT_ACCESS_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_a_different_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://127.0.0.1:6379
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
```

Rules:

- Never reuse access and refresh secrets.
- Never commit `.env` files.
- Use HTTPS in production.
- Add only exact trusted origins to `FRONTEND_URL`; do not use a wildcard with credentials.
- Configure Redis in multi-instance production deployments.

### Step 3: Admin environment

Create `Admin/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

`NEXT_PUBLIC_API_URL` is visible to the browser. It must contain only the public API base URL, never a secret.

### Step 4: install and run

Backend:

```powershell
cd backend
npm install
npm run start:dev
```

Admin in a second terminal:

```powershell
cd Admin
npm install
npm run dev
```

Local addresses:

- Admin: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Health: `http://localhost:8080/health`
- Swagger in non-production: `http://localhost:8080/api/docs`

### Optional seed commands

```powershell
cd backend
npm run seed:places
npm run seed:xp
```

The XP seed affects backend user progression. It does not restore removed Admin XP management pages.

## 6. Authentication and session behavior

### Signup

`POST /auth/signup` accepts a ten-digit phone number, a strong password, and optional first/middle names. Public signup explicitly rejects a client-supplied role and always creates a normal user. The backend hashes the password, creates the profile, issues access/refresh tokens, hashes the refresh token in MongoDB, and sets cookies.

### Login

`POST /auth/login` validates phone/password, rejects inactive accounts, checks temporary account lockout, resets failed attempts after success, issues tokens, stores the refresh-token hash, and returns safe user/profile data.

After five failed password attempts, the current code locks the account for approximately fifteen minutes.

### Cookies

- `access_token`: HTTP-only, approximately 15 minutes;
- `refresh_token`: HTTP-only, approximately 7 days;
- `csrf_token`: readable by frontend JavaScript for the double-submit CSRF header.

In production, authentication cookies use `Secure` and `SameSite=None`. In development they use `SameSite=Lax` without `Secure`.

### Admin session gate

The Admin layout calls `GET /auth/me`. A non-admin response is rejected and redirected to `/login?reason=admin-only`. The Axios response interceptor attempts one refresh after a protected request returns 401. Admin inactivity triggers logout after five minutes.

The frontend gate is usability protection, not the security boundary. Backend admin endpoints must always retain `JwtAuthGuard`, `RolesGuard`, and `@Roles(Role.Admin)`.

### Refresh and logout

`POST /auth/refresh` validates the refresh cookie and compares it to the stored bcrypt hash. A mismatch revokes the stored session. Successful refresh rotates both tokens. `POST /auth/logout` clears cookies and nulls the stored refresh-token hash.

## 7. Backend functionality by module

### Application and health

- `GET /` returns the service greeting.
- `GET /health` reports application status and MongoDB connection state.
- Swagger is enabled only when `NODE_ENV !== production`.

### Auth (`/auth`)

- signup;
- login;
- token refresh;
- logout/revocation;
- current-user lookup;
- sample admin-only authorization endpoint;
- deprecated profile update endpoint that returns HTTP 410.

### Users and profiles (`/user`)

User functions:

- read/update/delete own profile;
- submit XP events and achievement events through the backend progression engine;
- read own XP history;
- set a referrer;
- submit ratings;
- create photo-verification requests;
- search public profiles;
- read a profile by ID.

Admin functions:

- paginated profile list with search/status filters;
- global photo-verification queue;
- user detail retrieval;
- campaign quota update;
- profile edit;
- two-stage deletion;
- approve/reject photo-verification requests.

The first Admin delete deactivates the user. A second delete against an already inactive user permanently deletes the profile and linked authentication record. This flow must be protected by a confirmation dialog and backend state checks.

Admin manual XP/rank mutation endpoints were removed. User gamification remains backend-driven.

### Campaigns (`/campaigns`)

- create and list campaigns;
- Admin list by lifecycle phase;
- Admin paginated list;
- Admin bin list;
- retrieve campaign details;
- join, leave, and confirm participation;
- change participant role;
- update planning data;
- create/update tasks;
- perform phase transitions;
- edit campaign;
- submit for review;
- host verification;
- Admin approval/rejection;
- Admin verification approval/rejection;
- soft-delete to bin;
- restore;
- permanent delete.

Campaign rules include approval state, schedule dates, join windows, participant limits, host restrictions, solo/group behavior, task/planning state, completion, failure, and verification deadlines.

`CampaignScheduler` runs lifecycle housekeeping every five minutes. Scheduled jobs must run in exactly the intended number of instances; multi-instance deployment may require a distributed lock to prevent duplicate work.

### Trips (`/trips`)

- authenticated create/list/detail/update;
- Admin-only deletion;
- join;
- check-in;
- participant listing;
- Admin participant approval;
- Admin completion confirmation.

### Reviews (`/reviews`)

- create a participant review for a trip;
- read reviews received by a user;
- read user review statistics;
- read reviews given by a user with owner/Admin checks;
- read trip reviews;
- Admin paginated review list;
- owner/Admin update and delete.

Some review read endpoints are intentionally unguarded and therefore public. Confirm that public visibility is a product requirement.

### Reports (`/reports`)

- authenticated feedback submission;
- report a target;
- Admin/moderator open queue;
- Admin all-reports queue and statistics;
- reports for a target;
- assigned reports;
- Admin assignment;
- Admin/moderator status changes.

### Extra configuration (`/extra`, `/places`)

- public/consumer place catalog;
- Admin create/list/detail/update/delete Extra records;
- Admin place hierarchy;
- Admin bulk place seed;
- Admin place patch operations;
- Admin read/save difficulty settings.

The active Admin UI exposes Places, Difficulty, and Activities. Backend Extra categories may still include XP, badge, level-up, and achievement records for user progression or legacy data, but those management screens are no longer active Admin routes.

### Achievements, rank-up achievements, XP ledger, and badges

The backend still contains user gamification services and schemas:

- achievement definitions and user progress;
- rank-up achievement definitions and user progress;
- XP ledger/history and repeat-event protection;
- badge awarding endpoint under `/admin/profiles/:id/badges`;
- automatic progression initiated by confirmed backend events.

Achievement definition list/detail endpoints and several rank-up definition endpoints are readable without an Admin role. Verify whether they are intended to be public or merely authenticated.

The daily streak event and daily hard-reset behavior are not part of the intended XP system. Do not reintroduce `daily_streak` configuration or reset user progression by date.

### Chat (`/chat`)

- person-to-person conversations;
- general and campaign groups;
- conversation/unread lists;
- group detail;
- member add/remove/leave;
- send/list/edit/delete messages;
- mark messages read;
- unread counts;
- message search.

All current chat controller routes require authentication. Services must enforce conversation membership for every read and mutation, not only rely on possession of a group/message ID.

### Notifications (`/notifications`)

- list all or unread notifications;
- unread count;
- mark one or all read;
- delete a notification.

Every notification endpoint requires authentication and must scope database queries to the current user.

### Cloudinary (`/cloudinary/signature`)

Any authenticated user can request a signed upload. The request currently accepts an optional folder string. The client uploads directly to Cloudinary using the returned signature.

Test folder restrictions, file type, file size, transformation abuse, overwrite behavior, public IDs, orphan cleanup, and quota exhaustion. A valid signature alone is not a complete upload policy.

### Admin geocoding and weather (`/admin`)

- Admin-only geocode lookup;
- Admin-only weather lookup.

These functions depend on external services. Validate query bounds, timeouts, caching, provider failure behavior, and SSRF protections in the service implementation.

### Media

`MediaModule` registers a schema and service but no controller. `Admin/components/media-moderation-manager.tsx` calls `/media/pending`, `/media/stats`, and approval/rejection endpoints that are not currently registered by the backend. Treat this UI component as disconnected until a guarded controller is implemented or the component is removed.

### Treasure hunt

Treasure-hunt controller/service/schema files exist, but `TreasureHuntModule` is not imported by `AppModule`. Its endpoints are therefore not active in the running backend. The Admin `/treasurehunt` page is a "Coming Soon" placeholder.

## 8. Active Admin frontend pages

| Route | Functionality | Backend dependency |
| --- | --- | --- |
| `/login` | Admin phone/password login | `/auth/login`, `/auth/logout` |
| `/dashboard` | User/profile operational summary and recent users | `/user/admin/profiles` |
| `/users` | Search, active/inactive filter, pagination, responsive actions, deactivate/permanent delete | `/user/admin/profiles` |
| `/users/[id]` | Profile detail/edit, photo requests, two-stage deletion | `/user/admin/profiles/:id` and photo-review route |
| `/photo-verification-queue` | Global request filter, pagination, approve/reject | Admin photo-verification endpoints |
| `/reports` | Report list, stats, status moderation | `/reports/admin/*`, `/reports/:id/status` |
| `/analytics` | Profile/account analytics | `/user/admin/profiles` |
| `/profile` | Admin's own profile and image update | `/user/profile`, Cloudinary signature |
| `/my-campaign` | View open/upcoming campaigns and join/apply | campaign list/join routes |
| `/campaigns/add` | Create campaigns and upload images | campaign, Extra, places, Cloudinary APIs |
| `/campaigns/details` | Paginated/filterable campaign list | `/campaigns/admin/list` |
| `/campaigns/details/[id]` | Full campaign edit, participants, tasks, planning, media, lifecycle actions | campaign detail/action routes |
| `/campaigns/approval` | Review submitted campaigns | Admin campaign list/approve/reject |
| `/campaigns/bin` | View soft-deleted campaigns, restore, permanent delete | Admin bin routes |
| `/campaigns/reviews` | Review list/update/delete | review Admin routes |
| `/extra/places` | Place hierarchy/catalog management and weather/geocoding helpers | Extra and Admin utility routes |
| `/extra/difficulty` | Difficulty labels, approval behavior, order, enabled state | `/extra/difficulty` |
| `/extra/activities` | Activity record management | `/extra` CRUD |
| `/treasurehunt` | Placeholder only | no active backend integration |

The sidebar currently exposes Dashboard, Users, Photo Queue, Reports, Analytics, My Profile, My Campaign, campaign tools, Places, Difficulty, and Activities. Routes should not be considered protected merely because they are absent from the sidebar.

## 9. Important end-to-end workflows

### Admin login

1. Admin submits phone/password.
2. Backend verifies credentials, role state, lockout state, and account activity.
3. Backend sets access, refresh, and CSRF cookies.
4. Admin frontend verifies the returned role.
5. Protected layout rechecks `/auth/me`.
6. Axios retries one request after refresh if access expires.
7. Five minutes of inactivity logs the Admin out.

### User deletion

1. Admin selects Delete on an active user.
2. A custom confirmation modal appears; browser `confirm()` must not be used.
3. Backend marks both profile/account inactive and invalidates access through the active-account check.
4. The inactive user is visible through the inactive filter.
5. A second confirmed delete permanently removes linked data as implemented by the service.
6. The user list refreshes and no stale actions remain hidden behind the sidebar.

### Campaign lifecycle

```text
Draft/create
  -> submit when review is required
  -> Admin approve or reject
  -> join/apply and participant confirmation
  -> planning/tasks and active campaign window
  -> host verification/photo evidence
  -> Admin verification decision where required
  -> completed or failed
  -> optional soft-delete/bin
  -> restore or permanent delete
```

### Photo verification

1. User submits a campaign photo request.
2. Request appears in the global Admin queue and user-detail view.
3. Admin approves or rejects with an optional note.
4. Backend records reviewer and review state.
5. Any XP reward must be produced by the confirmed backend event, not by frontend assumptions or Admin manual XP controls.

### Backend XP award

1. A real backend action produces a supported event key.
2. The XP service validates the event and context.
3. Repeat/idempotency policy is checked.
4. Matching enabled rules are evaluated.
5. The ledger stores the award.
6. Profile total/level/rank and achievements are updated as applicable.
7. The response reflects the committed backend result.

There is no daily streak reset. Signup/onboarding UI must not claim XP unless signup completion triggers and commits an actual supported backend event.

## 10. Data model overview

MongoDB schema areas include:

- Auth account: phone, email, password hash, role, active state, refresh-token hash, login failures, lock time;
- User profile: auth link, identity/profile fields, visibility, progression, photo requests, admin flags, quota data;
- Campaign: host, schedule, location, participants, planning, tasks, approval, phase, verification, deletion state;
- Trip and trip participant;
- Extra configuration and place catalogs;
- XP ledger and visited places;
- achievement definitions, user achievements, rank-up achievements;
- badges;
- reviews and reports;
- notifications;
- chat groups and messages;
- media records;
- treasure hunts and progress.

The Auth account and User profile are separate documents linked by `User.authId`. Deactivation/deletion and identity checks must keep both records consistent.

## 11. Existing security controls

The code currently includes:

- bcrypt password hashing;
- hashed refresh tokens;
- refresh rotation and revocation;
- active-account database check on access-token validation;
- JWT expiration validation;
- Admin role guards on primary Admin APIs;
- global DTO whitelist and rejection of unknown fields;
- Helmet headers;
- exact-origin credentialed CORS configuration;
- 64 KB JSON/form request-body limits;
- double-submit CSRF validation for cookie-authenticated mutations;
- auth rate limiting per minute and hour;
- temporary account lockout;
- non-production-only Swagger;
- no-store response headers;
- request logging and audit events for selected Admin/auth operations;
- Cloudinary server-side signing;
- soft-delete before permanent user deletion.

These controls reduce risk but do not replace the tests below.

## 12. Main engineering and operational problems

### P0: unresolved merge conflicts

Admin and Flutter cannot be trusted or released until conflicts are resolved and tested. Conflict resolution can also silently restore removed XP/rank Admin UI, broken logout behavior, or older responsive layouts.

### P0: vulnerable direct dependencies

The current Admin audit reports direct high-severity advisories affecting:

- `next` 16.2.4; the audit recommends an available patched version;
- `axios` 1.15.1; the audit reports multiple advisories with fixes available.

The current backend audit reports direct or framework-chain advisories affecting:

- `@nestjs/platform-express` through Multer;
- `@nestjs/swagger` through `js-yaml`;
- `mongoose` 9.x prototype-pollution advisory range.

Other transitive audit findings include `brace-expansion`, `fast-uri`, `form-data`, `ip-address`, `postcss`, `sharp`, `qs`, `body-parser`, and Babel/tooling packages. Re-run the audit after resolving the lockfiles and upgrading dependencies.

Never run `npm audit fix --force` blindly. Upgrade in a branch, inspect lockfile changes, run migrations if required, and execute the complete regression suite.

### P1: stale and duplicate code paths

- Old Admin READMEs still describe removed gamification screens.
- Legacy gamification manager components remain in the source but have no active routes.
- Media moderation UI calls routes that do not exist.
- Treasure-hunt backend files exist but its module is not registered.
- Flutter contains duplicate/parallel screen file structures and conflict markers.

These increase maintenance risk and make it easy to reintroduce old behavior accidentally.

### P1: limited automated security and end-to-end coverage

Controller/service unit tests exist mainly around basic app/auth areas. There is not enough visible automated coverage for authorization, campaign concurrency, deletion consistency, CSRF, refresh reuse, upload abuse, chat membership, report moderation, or XP idempotency.

### P1: distributed-runtime assumptions

- Rate limiting falls back to process memory without Redis.
- Campaign cron runs in each backend instance unless deployment coordination prevents duplication.
- No distributed lock is shown around scheduler execution.
- Reverse-proxy trust behavior is not explicitly configured in bootstrap.

### P1: external service reliability

Cloudinary, MongoDB, Redis, geocoding, and weather failures need explicit timeouts, retry limits, fallback UX, alerts, and quota monitoring.

### P2: error/status consistency

Some controller flows return `{ error: 'Unauthorized' }` rather than throwing HTTP 403. Normalize errors so clients, logs, and security monitors receive correct status codes.

## 13. Security vulnerability test plan

Run all tests in an isolated environment with test accounts and disposable data. Record request, response, account role, database state, expected result, actual result, evidence, severity, owner, and remediation date.

### A. Authentication

1. Test valid/invalid phone and password combinations.
2. Confirm errors do not disclose whether a phone number exists.
3. Verify five failed attempts produce lockout and that lockout cannot be bypassed by case, spacing, alternate content type, IPv6, or parallel requests.
4. Verify password policy is enforced by the backend, not only the UI.
5. Attempt signup with `role`, `isActive`, refresh fields, nested objects, and unknown fields; expect HTTP 400 and no privilege change.
6. Verify inactive accounts cannot login, refresh, or use an existing access token.
7. Test logout followed by access-token and refresh-token reuse.
8. Test an old refresh token after successful rotation; it must fail and follow the chosen session-reuse policy.
9. Test concurrent refresh requests for race conditions.
10. Change an Admin role to user in the database and verify existing access is removed within the defined policy. The access strategy currently checks active state but uses the role claim from the token, so privilege persistence until token expiry must be assessed.

### B. Authorization and IDOR/BOLA

Create separate accounts: user A, user B, moderator, Admin 1, and Admin 2.

For every endpoint containing an ID:

- replace the object ID with another user's object;
- test valid, invalid, deleted, and malformed IDs;
- test normal user, moderator, inactive user, expired token, and no token;
- verify both response and database state.

High-priority objects:

- profiles and campaign quota;
- campaigns, participants, tasks, planning, verification, restore, and permanent delete;
- trip participants and completion;
- reviews and reports;
- chat groups/messages/member changes;
- notifications;
- photo-verification requests;
- achievements and badges;
- Cloudinary signatures.

Expected result: only the owner/host/member or explicitly authorized role can act. Hidden UI controls are not authorization.

### C. Admin role enforcement

1. Call every `/user/admin/*`, `/campaigns/admin/*`, report Admin route, Extra mutation, Admin weather/geocode route, badge award, and achievement mutation with a normal user token.
2. Repeat with only a forged frontend Zustand state; backend must still return 403.
3. Attempt to modify the JWT payload without a valid signature.
4. Test a token issued before role removal.
5. Verify moderator access is limited to report routes that explicitly allow it.

### D. CSRF and cookie security

1. Send every cookie-authenticated POST/PATCH/PUT/DELETE without `x-csrf-token`; expect 403.
2. Send a mismatched header/cookie pair; expect 403.
3. Test bearer-token-only mutation without cookies; it should follow the documented non-cookie client policy.
4. Test login CSRF, refresh CSRF, and logout CSRF from an untrusted origin.
5. Verify production cookies have `Secure`, appropriate `SameSite`, correct domain/path, and HTTP-only on auth cookies.
6. Verify the readable CSRF cookie cannot be stolen through any XSS path.
7. Test subdomain cookie injection if production uses shared parent-domain cookies.
8. Confirm CORS rejects arbitrary origins, `null`, suffix matches, scheme changes, and attacker-controlled subdomains.

### E. Session and browser behavior

1. Verify inactivity logout at five minutes.
2. Test multiple tabs, browser back/forward cache, refresh during logout, and browser restart.
3. Confirm protected data is not visible from browser cache after logout.
4. Verify refresh failures clear local Admin state and redirect once without loops.
5. Test multiple simultaneous 401 responses; ensure refresh requests do not create a storm or inconsistent token rotation.

### F. Injection and unsafe input

Test DTO and service handling for:

- MongoDB operators such as object values where strings are expected;
- prototype keys including `__proto__`, `constructor`, and dotted paths;
- stored/reflected HTML and script payloads in names, bios, campaign descriptions, tasks, reviews, reports, chat, notes, and place labels;
- formula injection if data is ever exported to CSV;
- header/log injection with newline characters;
- extremely deep JSON and arrays;
- malformed ObjectIds and Unicode normalization.

Expected result: validation rejects invalid types, React renders user content as text, MongoDB updates cannot modify unintended fields, and logs remain one structured event per request.

### G. File upload and Cloudinary

1. Request signatures as user and Admin for arbitrary folder names, traversal-like names, oversized strings, and reserved folders.
2. Upload oversized files, non-images renamed as images, SVG/script content, polyglots, decompression bombs, and malformed images.
3. Verify Cloudinary transformation limits, overwrite rules, allowed formats, maximum dimensions, and quota controls.
4. Confirm users cannot replace/delete another user's asset by guessing a public ID.
5. Verify rejected or abandoned uploads are cleaned up.
6. Test image URLs rendered by Next.js and Flutter for untrusted schemes/hosts.

### H. SSRF and external integrations

Test weather/geocode inputs and any server-side URL fetches with:

- localhost and private network ranges;
- IPv4-mapped IPv6 and alternate IP notation;
- redirects to private hosts;
- DNS rebinding-resistant validation;
- very slow providers and oversized responses.

Expected result: user input cannot control an arbitrary destination, private/internal networks are blocked where applicable, and all outbound calls have strict timeouts.

### I. Rate limiting and denial of service

1. Verify login/signup/refresh/logout minute and hour limits.
2. Test behind the real reverse proxy/load balancer and confirm the client IP is interpreted correctly.
3. Repeat across multiple backend instances; limits must remain shared through Redis.
4. Test expensive searches, chat message search, reports, analytics pagination, Cloudinary signatures, and external weather/geocode calls.
5. Test request bodies at, below, and above 64 KB.
6. Test large query limits, negative pages, huge strings, deep objects, and concurrent requests.
7. Confirm scheduler jobs do not run twice across replicas.

### J. Campaign business logic and race conditions

1. Submit parallel join requests for the final available seat.
2. Attempt duplicate joins with multiple sessions.
3. Join before the open date, after the end date, while unapproved, deleted, completed, failed, or awaiting verification.
4. Test host joining their own campaign.
5. Test role/task/planning changes by non-host participants.
6. Race approve versus reject, verify versus reject, restore versus permanent delete, and scheduler versus manual transition.
7. Manipulate client dates/time zones; backend time must be authoritative.
8. Confirm campaign rewards are idempotent when verification or cron work repeats.

### K. User deletion and data lifecycle

1. Delete an active user and confirm only deactivation occurs.
2. Verify all existing tokens stop working immediately.
3. Confirm inactive filtering and re-login behavior.
4. Perform second delete and verify intended linked records are removed or anonymized.
5. Test deletion while the user owns campaigns, messages, reports, reviews, media, and notifications.
6. Test two Admins deleting the same account concurrently.
7. Verify audit records remain but do not retain unnecessary personal data.
8. Document backup retention and restoration behavior.

### L. XP and achievement integrity

1. Trigger the same confirmed event twice and verify repeat/idempotency policy.
2. Attempt removed `daily_streak` and daily reset behavior; expect no award/reset.
3. Attempt unsupported event keys and forged context.
4. Verify signup/onboarding cannot claim XP without a committed backend event.
5. Race event submissions and campaign verification.
6. Verify reward XP cannot recurse or award infinitely through achievements.
7. Test disabled, malformed, negative, or extremely large Extra rules.
8. Confirm normal users cannot access removed Admin XP mutation functionality.

### M. Chat, notification, review, and report privacy

1. Read/search/edit/delete messages outside group membership.
2. Add/remove members without group permission.
3. Access another user's notifications by ID.
4. Edit/delete another user's review.
5. Access moderator/Admin report details as a normal user.
6. Store XSS payloads in chat/reviews/reports and view them in Admin.
7. Verify blocked/deactivated users cannot continue messaging.

### N. Data exposure and privacy

1. Inspect all API responses for password hashes, refresh hashes, internal flags, private email/phone, Cloudinary secrets, stack traces, and database details.
2. Verify public profile/search endpoints expose only approved public fields.
3. Verify `/health` reveals no credentials or infrastructure addresses.
4. Confirm Swagger is absent in production.
5. Test browser cache, CDN cache, and proxy cache for authenticated responses.
6. Search source/history/build output for secrets before release.

Suggested secret checks:

```powershell
rg -n -i '(api[_-]?key|api[_-]?secret|jwt[_-]?secret|mongodb\+srv|password\s*=|bearer\s+[A-Za-z0-9])' . --glob '!**/node_modules/**' --glob '!**/.git/**'
```

### O. Dependency and supply-chain security

Run:

```powershell
cd Admin
npm audit
npm outdated

cd ..\backend
npm audit
npm outdated
```

Then:

- upgrade direct dependencies first;
- regenerate and review lockfiles;
- verify package integrity and install scripts;
- run production-only audit with `npm audit --omit=dev`;
- enable automated dependency PRs;
- generate an SBOM for releases;
- pin CI Node/npm versions;
- prevent secrets from entering build artifacts.

### P. Infrastructure and deployment

1. Enforce HTTPS and redirect HTTP.
2. Test HSTS after confirming all subdomains support HTTPS.
3. Verify CSP and frame-ancestor protection for Admin.
4. Restrict MongoDB/Redis/Cloudinary credentials and network access.
5. Validate backup encryption, restore drills, key rotation, log retention, and incident response.
6. Test graceful behavior when MongoDB, Redis, Cloudinary, weather, or geocoding is unavailable.
7. Verify production logs do not contain tokens, cookies, passwords, or sensitive payloads.

## 14. Testing and verification commands

### Backend

```powershell
cd backend
npx tsc -p tsconfig.build.json --noEmit
npm run build
npm test
npm run test:e2e
npm audit
```

### Admin

```powershell
cd Admin
npx next typegen
npx tsc --noEmit
npm run lint
npm run build
npm audit
```

### Flutter

```powershell
cd Users
flutter pub get
flutter analyze
flutter test
```

### Repository gates

```powershell
rg -n '^(<<<<<<<|=======|>>>>>>>)' Admin backend Users
git diff --check
```

Release acceptance requires:

- no conflict markers;
- all compilers/builds passing;
- automated tests passing;
- no unresolved critical/high direct dependency advisory without documented acceptance;
- authorization/IDOR suite passing;
- CSRF/session suite passing;
- campaign concurrency and deletion tests passing;
- production configuration review completed.

## 15. Production deployment checklist

1. Resolve conflicts and remove dead/duplicate code.
2. Upgrade vulnerable dependencies and review lockfiles.
3. Run all checks in section 14.
4. Use long, unique production secrets from a secret manager.
5. Set `NODE_ENV=production`.
6. Configure exact HTTPS origins in `FRONTEND_URL`.
7. Use TLS for MongoDB and Redis.
8. Configure Redis-backed rate limiting.
9. Decide reverse-proxy trust settings and verify client-IP rate limiting.
10. Run database backups and a restore drill.
11. Configure Cloudinary upload restrictions and quotas.
12. Ensure Swagger is disabled.
13. Run backend behind a supervised process/container with health checks.
14. Ensure only one coordinated scheduler execution per job interval.
15. Configure structured logs, metrics, alerts, and audit retention.
16. Deploy to staging and execute the security regression plan.
17. Obtain explicit approval before production rollout.

Suggested production commands after a clean build:

```powershell
cd backend
npm ci
npm run build
npm run start:prod
```

```powershell
cd Admin
npm ci
npm run build
npm run start
```

## 16. Troubleshooting

### Admin shows TypeScript or JSX parser errors

Run the conflict-marker search first. Current errors are caused primarily by unresolved merge conflicts. After resolving them, delete/regenerate Next build metadata if route types remain stale:

```powershell
cd Admin
npx next typegen
npx tsc --noEmit
```

### Hydration warning includes `cz-shortcut-listen`

That attribute is commonly injected into `<body>` by a browser extension. Test in a clean/incognito browser profile. `suppressHydrationWarning` can suppress the known body-level mismatch but should not be used to hide real invalid HTML or nondeterministic rendering.

### Admin repeatedly redirects to login

Check:

- backend is reachable at `NEXT_PUBLIC_API_URL`;
- `FRONTEND_URL` exactly matches the Admin origin;
- cookies are accepted by the browser;
- production requests use HTTPS with `Secure` cookies;
- account role is Admin and account is active;
- access/refresh secrets match the issuing backend;
- CSRF cookie/header are present on mutations.

### CSRF 403

Confirm the browser has `csrf_token` and Axios sends the same value in `x-csrf-token`. Check cookie domain, path, SameSite, HTTPS, and frontend/backend site topology.

### MongoDB startup failure

Verify `MONGODB_URI`, network allowlists, TLS options, credentials, and the configured connection timeouts. The backend intentionally waits for MongoDB before listening.

### Rate limits affect every user behind a proxy

Verify the real deployment's proxy and trusted-client-IP configuration. Do not enable broad proxy trust without understanding spoofing risk. Confirm Redis is used across replicas.

### Upload succeeds but image is missing

Check Cloudinary credentials, signed parameters, allowed folder/format rules, upload response, persisted `secure_url`/public ID, and cleanup behavior.

### Admin feature calls 404

Compare the Admin API call with registered backend controllers. Media moderation routes and treasure-hunt routes are currently not active despite source/components existing.

## 17. Maintenance rules

- Treat backend guards and service ownership checks as the authorization boundary.
- Keep DTO validation on every external mutation.
- Add tests with every bug fix, especially authorization and race-condition tests.
- Do not expose secrets through `NEXT_PUBLIC_*` variables.
- Do not restore Admin XP/rank/achievement management unless product scope explicitly changes.
- Do not add daily streak resets to user progression.
- Frontend reward copy must match a confirmed committed backend event.
- Preserve two-stage user deletion: deactivate first, permanent delete second.
- Keep Admin tables/cards responsive and ensure actions remain usable beside the collapsible/mobile sidebar.
- Update this file whenever routes, security controls, environment variables, or deployment behavior changes.

## 18. Recommended remediation order

1. Resolve all merge conflicts.
2. Confirm removed Admin gamification behavior does not return during resolution.
3. Upgrade Next.js, Axios, Nest platform packages, Swagger/js-yaml chain, Mongoose, and other audited dependencies.
4. Restore passing Admin, backend, and Flutter builds.
5. Remove disconnected legacy components or implement their missing guarded backend routes.
6. Add automated auth, CSRF, RBAC, IDOR, deletion, upload, campaign-race, and XP-idempotency tests.
7. Configure Redis, reverse proxy, scheduler coordination, secrets, backups, and observability for staging.
8. Execute the complete security test plan.
9. Fix findings by severity and retest.
10. Release only after documented security and operational approval.
