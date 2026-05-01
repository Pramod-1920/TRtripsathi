# TRtripsathi Backend README (Backend Only)

This file documents what has already been implemented in the backend, section by section.

## 1. Backend Foundation

What is done:
- NestJS backend is wired through `AppModule` with global config loading from `.env` and `backend/.env`.
- MongoDB is connected with Mongoose via async configuration.
- App startup waits for MongoDB connection and logs connection status.
- Global validation is enabled with whitelist and forbidden unknown fields.
- Swagger is available at `/api/docs`.
- CORS is enabled for a configured frontend URL with credentials support.

Key files:
- `src/main.ts`
- `src/app.module.ts`
- `src/config/database/database.module.ts`
- `src/config/database/database.config.ts`

## 2. Authentication Section (`/auth`)

What is done:
- Phone number signup and login.
- Password hashing using bcrypt.
- Admin signup is blocked from public signup flow.
- Access and refresh JWT token flow is implemented.
- Tokens are set in cookies (`access_token`, `refresh_token`).
- Refresh token rotation is implemented.
- Multiple concurrent sessions are supported (configurable cap; older sessions trimmed).
- Failed login tracking with progressive delay.
- Account temporary lock after repeated failures.
- Logout revokes active sessions for the user.
- `GET /auth/me` returns authenticated user context.
- Admin-only protected route exists for role guard validation.
- Legacy `PATCH /auth/profile` endpoint is marked deprecated and returns `410`.

Implemented endpoints:
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/admin-only`
- `PATCH /auth/profile` (deprecated)

Key files:
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.module.ts`

## 3. User Profile + XP + Achievements Section (`/user`)

What is done:
- User profile lifecycle:
  - Create profile linked to auth account
  - Read own profile
  - Update own profile with sanitization and validation
  - Delete own profile and linked auth account
- Public profile retrieval and profile search with pagination/filtering.
- Cloudinary image cleanup integration for replaced profile images.
- Referrer linking (one-time referrer set flow).
- Rating submission flow.
- Photo verification request submission and admin review flow.
- XP engine implemented:
  - Rule parsing from extras collection (`category: xp`)
  - Event-based XP awarding
  - XP simulation without DB write
  - XP history read/update/delete (admin controls included)
  - Repeat logic and context-based conditions (campaign, district, difficulty, etc.)
- Achievement tracking implemented:
  - Achievement definition parsing from extras
  - Achievement event recording and reward handling
- Level progression and rank progress logic implemented.

Implemented user endpoints:
- `GET /user/profile`
- `PATCH /user/profile`
- `DELETE /user/profile`
- `GET /user/:id`
- `GET /user/search`
- `POST /user/xp/events`
- `POST /user/achievements/events`
- `GET /user/profile/xp/history`
- `POST /user/profile/referrer`
- `POST /user/ratings`
- `POST /user/photos/verification-requests`

Implemented admin endpoints under user:
- `GET /user/admin/profiles`
- `GET /user/admin/profiles/:id`
- `PATCH /user/admin/profiles/:id`
- `DELETE /user/admin/profiles/:id`
- `GET /user/admin/photo-verification-requests`
- `PATCH /user/admin/profiles/:id/photos/verification-requests/:requestCode`
- `POST /user/admin/profiles/:id/xp/events`
- `POST /user/admin/xp/simulate`
- `POST /user/admin/profiles/:id/xp/simulate`
- `PATCH /user/admin/profiles/:id/xp/history/:historyId`
- `DELETE /user/admin/profiles/:id/xp/history/:historyId`
- `POST /user/admin/profiles/:id/achievements/events`

Key files:
- `src/user/user.controller.ts`
- `src/user/user.service.ts`
- `src/user/user.module.ts`

## 4. Campaign Section (`/campaigns`)

What is done:
- Campaign creation, listing, details, update, and admin delete.
- Campaign code generation (`CMP-xxxxxx`) with uniqueness checks.
- User restrictions:
  - Non-admin users cannot create instant campaigns.
  - Non-admin scheduled campaigns must be at least 2 days in advance.
- Date validation:
  - Start, end, join-open consistency checks.
- Category validation is connected to enabled `activities` extras.
- Hike type normalization and validation (`solo`/`group`).
- Creator enrichment for campaign response (name, role, phone).
- Auto-close logic marks expired campaigns as completed.
- On auto-close, XP and achievements are awarded for host/participants.
- Admin delete performs soft-delete (`deletedByAdmin`) and stores admin flags for host profile.

Implemented endpoints:
- `POST /campaigns`
- `GET /campaigns`
- `GET /campaigns/admin/list`
- `GET /campaigns/:id`
- `PATCH /campaigns/:id`
- `DELETE /campaigns/:id` (admin)

Key files:
- `src/campaign/campaign.controller.ts`
- `src/campaign/campaign.service.ts`
- `src/campaign/campaign.module.ts`

## 5. Extras Management Section (`/extra`)

What is done:
- Admin-only CRUD for extra items.
- Extra code generation (`EXT-xxxxxx`) with uniqueness checks.
- Category-based listing with pagination.
- Supports enabling/disabling individual extras.
- This collection is actively used by:
  - XP rules (`category: xp`)
  - Achievement definitions
  - Activities used by campaign category validation

Implemented endpoints (admin-only):
- `POST /extra`
- `GET /extra`
- `GET /extra/:id`
- `PATCH /extra/:id`
- `DELETE /extra/:id`

Key files:
- `src/extra/extra.controller.ts`
- `src/extra/extra.service.ts`
- `src/extra/extra.module.ts`

## 6. Cloudinary Section (`/cloudinary`)

What is done:
- Protected upload signature generation endpoint.
- Cloudinary config validation from environment variables.
- Server-side image deletion helper is implemented and used by profile updates.

Implemented endpoint:
- `POST /cloudinary/signature`

Key files:
- `src/config/cloudinary/cloudinary.controller.ts`
- `src/config/cloudinary/cloudinary.service.ts`
- `src/config/cloudinary/cloudinary.module.ts`

## 7. Security Section

What is done:
- Helmet enabled globally.
- Cookie parser and JSON body parser configured.
- CORS restricted to frontend origin.
- Layered rate limiting on auth routes:
  - Per-minute and per-hour limits via `express-rate-limit`
  - Additional throttler guards on auth controller methods
- CSRF protection with double-submit cookie strategy for state-changing requests.
- Admin security headers middleware is active globally.
- Refresh token revocation service implemented:
  - Redis-backed if available
  - In-memory fallback if Redis is unavailable

Key files:
- `src/main.ts`
- `src/security/csrf.middleware.ts`
- `src/security/headers.middleware.ts`
- `src/security/token-revocation.service.ts`
- `src/security/security.module.ts`

## 8. Redis Section

What is done:
- Optional Redis service with dynamic runtime loading.
- Graceful no-op fallback when `REDIS_URL` is absent or `ioredis` is not installed.
- Redis currently supports security token revocation use case.

Key files:
- `src/redis/redis.service.ts`
- `src/redis/redis.module.ts`

## 9. Audit Section

What is done:
- Audit event logging is implemented across auth/user/campaign admin actions.
- Local append-only audit log file support (`logs/audit.log`).
- Optional S3 audit shipping per event when AWS env vars are configured.
- Best-effort fallback behavior (local logging remains if S3 fails).

Key files:
- `src/audit/audit.service.ts`
- `src/audit/audit.module.ts`

## 10. Scripts Section

What is done:
- XP seed script implemented (`npm run seed:xp`).
- Script is idempotent (upsert/update by rule identity).
- Seed prepares default dynamic XP rules in extras collection.

Key files:
- `scripts/seed-xp-rules.ts`
- `scripts/README.md`

## 11. Environment Variables (Used by Backend)

Required:
- `PORT`
- `FRONTEND_URL`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional:
- `JWT_ACCESS_EXPIRES_IN` (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN` (default: `7d`)
- `MAX_CONCURRENT_SESSIONS` (default: `3`)
- `MONGODB_CONNECT_TIMEOUT_MS` (default: `5000`)
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS` (default: `5000`)
- `REDIS_URL` (enables Redis-backed features)
- `AUDIT_S3_BUCKET` and `AWS_REGION` (enables S3 audit shipping)

## 12. Run Commands

```bash
npm install
npm run start:dev
```

Other commands:

```bash
npm run build
npm run start:prod
npm run test
npm run test:e2e
npm run seed:xp
```

```bash
npm run build
```

## Notes

- The auth module has a dedicated [AUTH_README.md](src/auth/AUTH_README.md) for endpoint-level details.
- Profile data is now separated into the user module to keep auth focused on credentials and token flows.
