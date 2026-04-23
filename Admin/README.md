## Admin security hardening — changes applied

This document summarizes recent backend and frontend changes made to harden the admin panel. It lists what was implemented, where to find the code, and recommended next steps.

Summary of changes implemented (backend)

- CSRF protection (double-submit cookie):
	- A non-httpOnly `csrf_token` cookie is now set when auth cookies are issued. A middleware at `src/security/csrf.middleware.ts` enforces that all state-changing requests (POST/PATCH/PUT/DELETE) include a matching `x-csrf-token` header or a `csrfToken` body field. This mitigates CSRF attacks by requiring the attacker-controlled site to have access to the csrf cookie (it doesn't).

- Rate limiting on auth endpoints:
	- Layered express rate-limits are applied to `/auth/login`, `/auth/signup`, `/auth/refresh`, `/auth/logout` in `src/security/rate-limit.ts` and wired in `src/main.ts`:
		- 5 requests per minute
		- 20 requests per hour
	- On limit excess the server now responds with 429.

- Progressive failed-login delays and temporary lockouts:
	- Failed login attempts increase a counter and introduce progressive delays (1s, 2s, 4s capped). After 5 failures, account is locked for 15 minutes (existing logic extended to include slowing responses).

- Audit logging:
	- `src/audit/audit.service.ts` writes JSONL audit events to `logs/audit.log` (timestamped). The system logs:
		- auth.signup, auth.login, auth.logout (including IP and user-agent when available)
		- auth.failed_login
		- admin.list_profiles, admin.view_profile, admin.update_profile, admin.delete_profile
	- In production you should ship these logs to an external audit service (ELK, Splunk, Datadog, S3) — do not rely on the local file system for long-term retention.

- Token revocation & Redis skeleton:
	- A `RedisService` and `TokenRevocationService` were added under `src/redis` and `src/security` respectively to support token blacklisting and token rotation.
	- On token refresh the previous refresh token is marked revoked (best-effort). This prepares the app for refresh-token rotation and per-user active session limits.
	- NOTE: you must run Redis and set `REDIS_URL` in your `.env` for this to be active. See `src/redis/redis.service.ts`.

- Headers & transport security:
	- `helmet()` remains enabled. Additional headers are set via `src/security/headers.middleware.ts` for `Referrer-Policy`, `Permissions-Policy`, and conservative `Cache-Control` (`no-store`) for admin-related responses.

Where to look in repo

- Backend bootstrap & middleware wiring: `backend/src/main.ts`
- CSRF middleware: `backend/src/security/csrf.middleware.ts`
- Rate limiters: `backend/src/security/rate-limit.ts`
- Audit logger: `backend/src/audit/audit.service.ts` (writes to `logs/audit.log`)
- Redis support: `backend/src/redis/*` and `backend/src/security/token-revocation.service.ts`
- Auth changes (cookies + csrf cookie): `backend/src/auth/auth.controller.ts` & `backend/src/auth/auth.service.ts`
- Admin headers: `backend/src/security/headers.middleware.ts`

Notes, limitations and compatibility

- sendBeacon logout: `navigator.sendBeacon` cannot add custom headers. The server middleware will accept either a header or a JSON body property `csrfToken` (double-submit fallback) for logout so a sendBeacon body containing the csrf token will still work. For full reliability prefer a fetch-based logout that includes the header. Browser behavior varies — test in your target browsers.

- CSRF token lifecycle: the csrf token cookie is non-httpOnly and set on login/refresh/signup. Ensure client code reads that cookie and sends it in `X-CSRF-Token` header for state-changing calls (the admin frontend was updated to do this where possible). If some automatic refresh calls don't include the header, the middleware accepts a `csrfToken` body parameter as a fallback.

- Rate limiter storage: the current limits are in-memory (express-rate-limit). For a production setup, use a distributed store (Redis) so limits are shared across instances.

- Audit storage: this implementation writes to a local file for speed of integration. For compliance, ship audit events to an external secure audit store.

Recommended next steps (pick one or more)

1. Implement concurrent session limits (server-side): track active refresh token ids per user in Redis and trim to 3, revoking older tokens automatically. This requires assigning stable token IDs when issuing refresh tokens.
2. Add pre-logout confirmation modal and proactive session refresh in the admin UI.
3. Harden `POST /auth/logout` server-side to accept and revoke sendBeacon-sent payloads reliably and clear cookies even when no header is present.
4. Switch rate-limiter to a Redis-backed store to make limits effective across multiple backend instances.
5. Move audit events to a remote secure audit store and add per-event integrity checks (signatures) if required for compliance.

If you want, I can implement option (1) (concurrent session trimming) next — it will require issuing refresh tokens with stable identifiers and storing them in Redis lists per user.
