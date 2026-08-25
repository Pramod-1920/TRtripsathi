# TRTripSathi Project Improvement Guide

**Created:** 2026-08-25  
**Scope:** Flutter user app (`Users/`), Next.js admin dashboard (`Admin/`), and NestJS backend (`backend/`)

## Purpose

This file is a practical checklist of what should be improved and what must be investigated before TRTripSathi is considered production-ready. Complete the items in priority order and update the status, owner, and evidence when work is finished.

Status meanings:

- `TODO` - not started
- `IN PROGRESS` - actively being implemented
- `BLOCKED` - requires a decision, credentials, data, or external service
- `DONE` - implemented, tested, deployed, and verified

## P0 - Fix before the next release

### 1. Verify-a-place location selection

**Status:** IN PROGRESS

The expected flow is:

1. Show every active province.
2. After selecting a province, show all its active districts.
3. After selecting a district, show all its active municipalities.
4. After selecting a municipality, show only the places belonging to it.
5. Disable the visited-place field when that municipality has no configured places and show a clear message.

What to investigate:

- Confirm `GET /extra/places` returns `province -> districtItems -> municipalityItems -> places` on the deployed server.
- Confirm provinces, districts, and municipalities with zero places are still returned.
- Test old and new catalog response formats during deployment transitions.
- Confirm changing a parent dropdown clears every dependent selection.
- Confirm Flutter dropdown widgets receive new keys/state after a parent changes.
- Add loading, empty, retry, and malformed-response states.
- Test duplicate names in different districts and municipalities.
- Test the complete flow on a physical Android device after a full restart.

Required automated coverage:

- Backend catalog test for municipalities with zero places.
- Flutter parser test for the current nested response.
- Flutter compatibility test for the legacy flat `placeItems` response.
- Widget test covering Province -> District -> Municipality -> Visited place.

### 2. Verify the complete photo-verification journey

**Status:** TODO

- Test camera and gallery permissions on supported Android/iOS versions.
- Test location permission denied, denied forever, GPS disabled, timeout, and poor accuracy.
- Show the configured verification radius and current GPS accuracy before submission.
- Prevent accidental repeated submission while uploads are in progress.
- Confirm uploaded files are cleaned up when a later step fails.
- Test pending, approved, rejected, and appealed requests end to end.
- Confirm XP and map progress are awarded exactly once under concurrent approval/retry.
- Give users a clear reason and next action when no visited places exist for a municipality.

### 3. Production configuration and secrets

**Status:** TODO

- Remove hard-coded server addresses and ensure all apps use environment-specific configuration.
- Search source, build scripts, logs, and documentation for credentials, tokens, private keys, database URLs, Cloudinary secrets, Firebase secrets, and SMTP credentials.
- Rotate any secret that was ever committed or printed in logs.
- Validate required environment variables during backend startup and fail with safe, useful messages.
- Keep development, staging, and production configuration separate.
- Require HTTPS in production and reject insecure API URLs in release builds.
- Document secret ownership and rotation procedures without recording secret values.

### 4. Authentication and authorization audit

**Status:** TODO

- Verify every backend route has the correct public/authenticated/admin/moderator policy.
- Test horizontal access control: one user must never read or modify another user's private data.
- Test admin role changes, disabled accounts, expired tokens, refresh-token reuse, and logout revocation.
- Apply rate limiting to login, signup, OTP, password reset, uploads, reports, and verification submissions.
- Confirm API error responses do not reveal whether an account exists.
- Review file upload type, size, signature, storage, and malware-handling rules.
- Add authorization tests for every sensitive controller.

## P1 - Reliability and maintainability

### 5. API contracts and generated models

**Status:** TODO

The Flutter client currently parses many responses through dynamic maps. This makes API changes easy to miss.

- Define explicit request/response DTOs for public API endpoints.
- Publish an accurate OpenAPI document from NestJS.
- Generate or maintain typed Dart and TypeScript API models.
- Version breaking API changes instead of silently changing response shapes.
- Standardize pagination, timestamps, nullability, validation errors, and error codes.
- Add contract tests shared by backend, Flutter, and Admin.

### 6. Break up oversized files and responsibilities

**Status:** TODO

- Split Flutter's large `ApiService` into feature clients such as auth, places, campaigns, reports, and profile.
- Move verify-a-place parsing and filtering out of the page widget into typed models/repositories/providers.
- Split very large Flutter pages into focused widgets and controllers.
- Split large backend services by business capability where transaction boundaries allow it.
- Extract repeated Admin API, loading, error, modal, table, and form logic.
- Adopt consistent dependency injection and test seams instead of static global calls.

### 7. Error handling and observability

**Status:** TODO

- Use stable machine-readable backend error codes and user-friendly client messages.
- Add a request/correlation ID across Flutter/Admin -> backend -> logs.
- Capture unhandled Flutter, browser, and backend errors in an approved monitoring service.
- Track API latency, 4xx/5xx rates, upload failures, OTP failures, notification failures, and job failures.
- Add alerts for sustained errors rather than isolated events.
- Redact passwords, tokens, OTPs, authorization headers, personal data, and image URLs where appropriate.
- Write a short incident-response and rollback procedure.

### 8. Database integrity and migrations

**Status:** TODO

- Create a documented migration strategy; do not depend only on runtime normalization.
- Add/verify indexes for common queries and review slow queries with real-like data.
- Enforce uniqueness and idempotency at the database level for XP, visits, joins, reviews, and verification decisions.
- Validate province/district/municipality/place relationships server-side for every write.
- Define deletion, restoration, retention, backup, and restore behavior.
- Test MongoDB backup restoration before production launch.
- Decide how renamed or merged Nepal administrative areas affect historical records.

### 9. Background jobs and external services

**Status:** TODO

- Make scheduled campaign lifecycle work safe when multiple backend instances run.
- Add retries with limits and idempotency for FCM, email, SMS, Cloudinary, and webhooks.
- Use queues for operations that should not delay API responses.
- Add dead-letter/failure visibility and an admin retry procedure.
- Test behavior when Redis, MongoDB, Firebase, Cloudinary, email, SMS, weather, or geocoding is unavailable.

## P1 - Testing and delivery

### 10. Automated test pyramid

**Status:** TODO

Minimum release suite:

- Backend unit tests for business rules and normalization.
- Backend integration tests using a disposable database.
- API authorization and validation tests.
- Flutter unit tests for models, repositories, and providers.
- Flutter widget tests for forms, cascading dropdowns, loading, empty, and error states.
- Admin component tests for high-risk forms and moderation actions.
- End-to-end tests for signup, onboarding, campaign creation/join/completion, report handling, place verification, approval, XP, and map progress.
- Concurrency tests for idempotent awards and moderation transitions.

Every bug fix should include a regression test that fails before the fix and passes afterward.

### 11. Continuous integration

**Status:** TODO

Every pull request should run:

```text
Backend: format check -> lint -> unit/integration tests -> build
Admin:   format check -> lint -> tests -> production build
Flutter: format check -> analyze -> tests -> debug/release build
Shared:  secret scan -> dependency audit -> contract checks
```

- Do not use auto-fixing lint commands as the only CI lint check.
- Cache dependencies safely to reduce build time.
- Block merging when required checks fail.
- Produce versioned artifacts from CI rather than rebuilding differently on the server.
- Add staging deployment and smoke tests before production promotion.

### 12. Deployment and rollback

**Status:** TODO

- Document exact backend, Admin, Android, and iOS release commands.
- Deploy API-compatible backend changes before dependent mobile releases.
- Keep backward compatibility because installed mobile apps cannot all update immediately.
- Add database migration and rollback steps to each release.
- Add post-deployment smoke tests for health, login, catalog, campaigns, uploads, notifications, and admin moderation.
- Record deployed commit/version in each running application.
- Define rollback triggers and verify that the previous artifact can be restored quickly.

## P2 - User experience and product quality

### 13. Consistent loading, empty, and error states

**Status:** TODO

- Use shared components for loading, retry, offline, permission denied, and empty states.
- Never leave a disabled field unexplained.
- Preserve user-entered form data after recoverable failures.
- Confirm destructive actions and clearly explain whether recovery is possible.
- Avoid generic messages such as `Something went wrong` when a safe actionable message is available.
- Add pull-to-refresh only where it matches user expectations.

### 14. Accessibility and localization

**Status:** TODO

- Finish English and Nepali localization for all user-facing strings; remove inline hard-coded strings.
- Correct corrupted/mojibake characters such as `â€¢`, `Â·`, and `â€¦` in source and documentation.
- Test text scaling, screen readers, contrast, tap targets, keyboard navigation, and focus order.
- Do not communicate status through color alone.
- Use consistent date, time, number, distance, and location formatting.
- Test long Nepali translations on small screens.

### 15. Performance

**Status:** TODO

- Measure startup time, screen render time, API latency, memory, image upload time, and app size before optimizing.
- Resize/compress images appropriately and show upload progress.
- Paginate large campaign, user, report, notification, audit, and place datasets.
- Avoid rebuilding or sorting large dropdown datasets inside widget builds.
- Review Admin bundle size and unnecessary client-side rendering.
- Load map geometry and markers efficiently and test low-memory devices.
- Add caching with explicit invalidation rules, not indefinite stale data.

### 16. Privacy, safety, and abuse prevention

**Status:** TODO

- Publish privacy, retention, account deletion, and community-safety policies.
- Explain why precise GPS and photos are collected and how long they are retained.
- Minimize location precision wherever exact coordinates are unnecessary.
- Restrict who can view original evidence photos and precise GPS data.
- Add report/block/mute flows where users interact.
- Add moderation audit trails and escalation rules.
- Review Nepal-specific legal and consent requirements with a qualified professional before launch.

## P2 - Product and data improvements

### 17. Nepal place catalog quality

**Status:** TODO

- Establish one canonical source for all 7 provinces, 77 districts, municipalities, and supported destinations.
- Store canonical IDs separately from display names.
- Preserve aliases for spelling and renamed-area compatibility.
- Validate every place's coordinates, category, municipality, district, province, and verification radius.
- Add an Admin import preview with validation errors before applying bulk changes.
- Track who changed catalog data and when.
- Add catalog versioning so clients and historical verification records can be traced.

### 18. Product analytics and success criteria

**Status:** TODO

- Define product metrics before adding more features.
- Suggested funnel: signup -> onboarding -> campaign view -> join/create -> completion -> verified visit -> return visit.
- Measure verification rejection reasons and dropdown/catalog failure rates.
- Separate operational metrics from product analytics.
- Obtain appropriate consent and avoid collecting unnecessary personal data.
- Use findings to remove confusing steps rather than only adding new screens.

### 19. Documentation and developer experience

**Status:** TODO

- Keep the root `README.md` focused on architecture, setup, and current verified status.
- Add `.env.example` files containing names and safe examples only.
- Document local seed data and test accounts without real credentials.
- Add architecture decision records for important choices.
- Document API compatibility, migrations, backups, queues, notifications, and media storage.
- Add contribution rules, branch/commit conventions, code-review expectations, and a definition of done.
- Update documentation in the same pull request as behavior changes.

## Recommended implementation order

### Phase 1 - Stabilize the current release

1. Complete and test the verify-a-place cascading location flow.
2. Verify deployed API/mobile compatibility.
3. Audit secrets and environment configuration.
4. Run authentication/authorization and upload-security checks.
5. Add regression tests for current critical journeys.

### Phase 2 - Make releases dependable

1. Add CI checks and staging smoke tests.
2. Introduce typed API contracts.
3. Establish migrations, backups, and rollback procedures.
4. Improve error monitoring and external-service retries.
5. Break up the highest-risk oversized files.

### Phase 3 - Improve product quality

1. Finish localization and accessibility.
2. Improve offline, empty, loading, and recovery experiences.
3. Measure and optimize performance.
4. Validate the complete Nepal catalog.
5. Add privacy controls and product analytics.

## Definition of done

An item is not `DONE` merely because code was written. It is done only when:

- Requirements and edge cases are documented.
- Implementation is reviewed.
- Automated regression tests pass.
- Security/privacy impact is considered.
- User-facing text and accessibility are checked.
- API compatibility is confirmed.
- Documentation is updated.
- The change is deployed to staging and smoke-tested.
- Production deployment and rollback are prepared.
- Production behavior is verified with non-destructive checks.

## Release checklist

- [ ] Correct commit and version selected
- [ ] No unexpected working-tree changes
- [ ] Secrets scan passed
- [ ] Dependency audit reviewed
- [ ] Backend lint, tests, and build passed
- [ ] Admin lint, tests, and production build passed
- [ ] Flutter format, analysis, tests, and release build passed
- [ ] API contract compatibility checked
- [ ] Database migration and backup checked
- [ ] Staging smoke tests passed
- [ ] Rollback artifact and instructions ready
- [ ] Production health/readiness checks passed
- [ ] Critical user journeys smoke-tested
- [ ] Monitoring checked after deployment
- [ ] Release notes and known limitations recorded

## How to maintain this file

For each active item, add:

```text
Owner:
Target release:
Status:
Evidence (test, pull request, screenshot, or monitoring link):
Remaining risk:
```

Review P0 items before every release, P1 items during sprint planning, and P2 items during product/technical roadmap reviews.
