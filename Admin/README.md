# TRTrips Admin Panel Guide

This README is the complete operational guide for the **Admin portal**: what it is, how to run it, what each area does, and how core flows work from login to campaign lifecycle, XP, ranking, achievements, and badges.

---

## 1. What this portal is

The Admin panel is a Next.js app used by admin users to:

- manage users and profiles
- review campaign submissions and bin/restore campaigns
- manage photo verification queue
- configure system data in **Extra** (Places, Difficulty, Activities, XP, Badge, Level Up, Achievement)
- monitor analytics and leaderboard-oriented profile data

Only users with `role=admin` are allowed into this UI.

---

## 2. Tech stack and architecture

## Frontend (Admin)

- Next.js 16 + React 19
- Axios (`withCredentials`) for cookie auth
- Zustand for session state
- Tailwind CSS + react-icons UI

## Backend (Core APIs)

- NestJS + Mongoose (MongoDB)
- Cookie-based JWT auth (access + refresh cookies)
- CSRF double-submit protection
- Role guards (`admin` vs `user`)
- Audit events for admin actions

## High-level flow

```text
Admin Browser
  -> Admin Next.js UI
    -> Axios API client (cookies + CSRF header)
      -> NestJS controllers (Auth/User/Campaign/Extra/etc.)
        -> Services (business rules)
          -> MongoDB (Auth/User/Campaign/Extra/...)
```

---

## 3. Setup and run

## Admin app

```bash
cd Admin
npm install
npm run dev
```

Important env:

- `NEXT_PUBLIC_API_URL` (required; configure it in `.env.local`)

## Backend app

```bash
cd backend
npm install
npm run start:dev
```

Required backend env (minimum practical set):

- `PORT`
- `FRONTEND_URL`
- `MONGODB_URI` (via database config)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- optional Redis/Cloudinary related vars depending on features

Swagger is available at:

- `http://localhost:<PORT>/api/docs`

---

## 4. Authentication, session, and security flow

## Login flow

1. Admin enters phone/password on `/login`.
2. UI calls `POST /auth/login`.
3. Backend sets:
   - `access_token` cookie (short-lived)
   - `refresh_token` cookie (longer-lived)
   - `csrf_token` cookie
4. UI saves user session in Zustand.
5. Non-admin role is rejected from Admin UI.

## Session validation

- Protected layout calls `GET /auth/me`.
- If unauthorized or non-admin -> redirect to `/login`.

## Token refresh

- Axios interceptor retries failed 401 requests by calling `POST /auth/refresh`.
- If refresh fails, user is redirected to login.

## CSRF

- State-changing methods require `x-csrf-token` matching `csrf_token` cookie.
- Admin API client auto-attaches this header.

## Additional protections

- auth rate limits (minute + hour)
- failed-login lockout behavior
- inactivity auto-logout in Admin UI
- audit logging for admin operations

---

## 5. Admin navigation map

Main sidebar areas:

- `Dashboard`
- `Users`
- `Photo Queue`
- `Analytics`
- `Campaigns`
  - Add Campaign
  - Campaign Details
  - Campaign Approval
  - Campaign Bin
- `Extra`
  - Places
  - Difficulty
  - Activities
  - XP
  - Badge
  - Level Up
  - Achievements

---

## 6. End-to-end lifecycle (from user signup to gamification)

## A) User account and profile

1. User signs up (`/auth/signup`) -> auth record created.
2. Profile is created in User collection.
3. User can complete profile and participate in campaigns.

## B) Campaign lifecycle

1. Campaign created (`POST /campaigns`) by host.
2. Approval status is decided:
   - auto-approved OR submitted (depends on difficulty config in Extra)
3. Admin may approve/reject submitted campaigns.
4. Participants join (`POST /campaigns/:id/join`).
5. Campaign auto-closes after its time window and enters verification window.
6. Host verifies completion (`POST /campaigns/:id/verify`), optionally with photo.
7. XP is awarded to host + accepted participants.
8. Achievements auto-progress from XP event context.
9. Rank and rank badges update from new XP/rank state.

## C) XP -> Rank -> Achievement chain

1. XP awarded by event engine (`awardXpForEvent`).
2. Level/rank progression applied from total XP.
3. Auto-achievement payloads generated from event context and rank-up result.
4. Achievement completions grant configured reward XP.
5. Rank badge visibility is derived from current rank and badge definitions in Extra.

---

## 7. Campaign creation requirements

Campaign creation DTO (`CreateCampaignDto`) fields:

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | non-empty |
| `category` | Yes | must match enabled Activity in Extra |
| `hikeType` | Yes | `solo` or `group` |
| `description` | No | text |
| `location` / `province` / `district` / `placeName` | No | location string is auto-built when needed |
| `difficulty` | No | influences approval + XP/achievement behavior |
| `durationDays` | No | numeric |
| `maxParticipants` | No | numeric |
| `estimatedNPR` | No | numeric |
| `scheduleType` | No | `instant` or `scheduled` (default scheduled) |
| `startDate` | Required for scheduled | users must schedule >= 2 days ahead |
| `endDate` | No | if instant, backend computes end date |
| `joinOpenDate` | No | defaults to start date |
| `joinMode` | No | `open` or `request` |
| `photos` | No | optional media metadata |

Timing validations:

- `endDate` must be after `startDate`
- `joinOpenDate` must be <= `startDate`
- non-admin cannot create instant campaigns
- non-admin scheduled campaign must start at least 2 days in future

---

## 8. Campaign joining rules

Join endpoint: `POST /campaigns/:id/join`

A user can join only if:

- campaign exists and is not admin-deleted
- campaign is `approvalStatus=approved`
- campaign is not completed/failed/awaitingVerification
- current time is within join window
- user is not the host
- participant is not already accepted/pending
- accepted participant count is below `maxParticipants`

Join result:

- if `joinMode=open` -> participant status becomes `accepted`
- if `joinMode=request` -> participant status becomes `pending`

---

## 9. XP system (how users gain XP)

Primary endpoint:

- user: `POST /user/xp/events`

XP rules are configured in **Extra category `xp`** (JSON in `value`).

Rule capabilities include:

- `eventKey`
- base XP / override XP
- repeat mode (`always`, `once_per_user`, `once_per_campaign`, etc.)
- condition matching (`difficulty`, `district`, `activityType`, `hostOnly`, `solo`, `ratingGte`, ...)
- difficulty multipliers
- exploration bonuses (first visit, new district, hidden gem, rare route)
- repeat-penalty behavior

If no matching rule exists, fallback XP logic runs.

## 10. Rank system (how users rank up)

Rank progression is derived from total XP and fallback rank bands:

- `F`: level 1
- `E`: level 2-10
- `D`: 11-20
- `C`: 21-30
- `B`: 31-40
- `A`: 41-50
- `S`: 51-60
- `SS`: 61-70
- `SSS`: 71-80
- `Mythic`: 81-90
- `Heroic`: 91+

Level from XP uses increasing threshold formula in backend (`getXpThresholdForLevel`).

`nextRankProgress` is computed and returned in many profile/XP responses to show:

- current XP in rank band
- required XP for next rank
- remaining XP
- any rule-based requirement gaps

---

## 11. Achievement system (current production path)

Achievements are configured through **Extra category `achievement`**.

Each achievement `value` JSON requires:

```json
{
  "key": "reach_e_rank",
  "subcategory": "rank_e",
  "targetCount": 1,
  "rewardXp": 200,
  "hidden": false
}
```

Important behavior:

- `rewardXp` is **required** and must be >= 1
- one-time completion: once `completedAt` is set, it does not unlock again
- completion grants reward XP

## Automatic achievement mapping

When XP events are processed, backend auto-generates achievement increments for subcategories such as:

- event-based: normalized event key
- activity-based: hikes/treks/temples/routes/quest chains
- location-based: `unique_locations`, `routes`
- difficulty-based:
  - `difficulty_completed`
  - `difficulty_easy_completed`
  - `difficulty_moderate_completed`
  - `difficulty_hard_completed`
  - `difficulty_extreme_completed`
- rank-based:
  - `rank_up`
  - `rank_<rank>` (e.g. `rank_e`, `rank_heroic`)

Manual achievement event endpoint still exists for forced adjustments:

- `POST /user/admin/profiles/:id/achievements/events`

---

## 12. Badge system

Rank badges are configured from **Extra category `badge`**:

1. badge item name is mapped to rank code
2. badge image URL comes from value JSON
3. unlocked badges are all badges up to current rank

---

## 13. Photo verification flow

Separate user flow for uploaded campaign photos:

1. user submits verification request (`POST /user/photos/verification-requests`)
2. admin reviews from queue (`PATCH /user/admin/profiles/:id/photos/verification-requests/:requestCode`)
3. approved request can trigger XP event (`solo_photo_uploaded` / `group_photo_uploaded`)

---

## 14. What a new admin can do immediately

1. Login at `/login` with admin credentials.
2. Check `Dashboard` for user + XP overview.
3. Manage `Users`:
   - edit profile fields
   - adjust XP/history
   - trigger XP simulation/events
4. Handle `Campaign Approval`:
   - approve/reject submitted campaigns
5. Use `Extra` to tune game economy:
   - activities/difficulty/places
   - XP rules
   - level-up rules
   - rank badges
   - achievements
6. Process `Photo Queue` requests.

---

## 15. Recommended configuration order (fresh deployment)

To avoid broken flows, configure in this order:

1. `Extra -> Places`
2. `Extra -> Activities`
3. `Extra -> Difficulty` (with `adminApprovalRequired` as needed)
4. `Extra -> XP` rules
5. `Extra -> Level Up` thresholds and requirements
6. `Extra -> Badge` rank badge definitions
7. `Extra -> Achievement` definitions

---

## 16. Key API endpoints (admin-focused quick reference)

## Auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh`

## Campaign

- `POST /campaigns`
- `GET /campaigns/admin/list`
- `POST /campaigns/:id/submit`
- `POST /campaigns/:id/approve`
- `POST /campaigns/:id/reject`
- `POST /campaigns/:id/join`
- `POST /campaigns/:id/verify`
- `DELETE /campaigns/:id` (bin)
- `POST /campaigns/:id/restore`
- `DELETE /campaigns/:id/permanent`

## User management

- `GET /user/admin/profiles`
- `PATCH /user/admin/profiles/:id`
- `GET /user/admin/photo-verification-requests`
- `PATCH /user/admin/profiles/:id/photos/verification-requests/:requestCode`

## Extra config

- `GET /extra`
- `POST /extra`
- `PATCH /extra/:id`
- `DELETE /extra/:id`
- `GET /extra/places`
- `GET /extra/places/hierarchy`

---

## 17. Notes

- This README documents the **current code path** where gamification is driven by UserService + Extra-configured rules.
- The repository still contains older achievement module artifacts (`/achievement` module), but admin game configuration in active flow is centered around `Extra` + `UserService`.

