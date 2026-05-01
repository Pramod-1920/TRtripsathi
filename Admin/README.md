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

---

## Admin User Management

This section documents the User collection schema, admin endpoints, and editable fields available in the admin panel.

### User Collection Structure

Each user document contains:

#### Profile Information
- `firstName`, `middleName`, `lastName` — User name
- `bio` — User biography/description
- `profilePhoto` (URL) — Avatar from Cloudinary
- `profilePhotoPublicId` — For cleanup when updated
- `dateOfBirth` — Calculated age derived from this
- `gender` — 'male', 'female', 'prefer_not_to_say'
- `languagesKnown` — Array of languages known
- `isProfilePublic` — Whether profile is visible to others

#### Location
- `location` — Computed display location
- `province`, `district`, `landmark` — Geographic details

#### Experience & Preferences
- `experienceLevel` — 'beginner', 'intermediate', 'advanced', 'expert'
- `notificationPrefs` — User notification settings

#### Gamification (Denormalized)
- `xp` — Total experience points
- `level` — Current level (calculated from XP)
- `rank` — Rank code ('noice', 'f', 'e', 'd', 'c', 'b', 'a', 's', 'ss', 'sss', 'mystic')
- `rankTitle` — Human-readable rank name
- `nextLevelXp` — XP needed for next level

#### Activity Tracking
- `achievementCounts` — Object tracking activity counts (hikes, treks, temples, difficult_routes, legendary_routes, quest_chains)
- `totalCompletedCampaigns` — Number of campaigns completed
- `totalHostedCampaigns` — Number of campaigns hosted

#### Trust & Verification
- `trustScore` — Average rating (0.0-5.0)
- `totalRatingsReceived` — Number of ratings
- `isVerifiedHost` — Boolean flag (set when totalHosted ≥5 AND trustScore ≥4.0)
- `adminFlags` — Array of admin actions taken on user's content

#### Referral System
- `referrerId` — ID of the user who referred this user (one-time set)
- `referralCode` — Unique 8-char code for inviting others
- `totalReferralCompletions` — Number of referees who completed campaigns

#### Exploration & Streaks
- `districtsVisited` — Count of unique districts completed
- `streakCurrentDays`, `streakMaxDays` — Streak tracking

#### Embedded Arrays
- `xpHistory` — Array of XP awards (paginated in queries)
- `ratings` — Array of received ratings with comments
- `photoVerificationRequests` — Array of pending photo verifications

### Admin User Endpoints

#### Viewing & Managing Users

**List all user profiles** (paginated)
```
GET /user/admin/profiles?page=1&limit=10
```
Returns paginated list of user profiles.

**Get specific user profile**
```
GET /user/admin/profiles/:profileId
```
Returns full user document with all fields.

**Search public profiles**
```
GET /user/search?q=name&experienceLevel=beginner&province=Bagmati&page=1&limit=10
```
Full-text search across public profiles.

#### Editing User Data

**Update any user profile field**
```
PATCH /user/admin/profiles/:profileId
```
Allowed editable fields:
- `firstName`, `middleName`, `lastName`
- `profilePhoto`, `profilePhotoPublicId`
- `bio`
- `location`, `province`, `district`, `landmark`
- `experienceLevel`
- `level`, `xp` (manual adjustments)
- `gender`, `languagesKnown`
- `isProfilePublic`
- `dateOfBirth` (updates age automatically)
- `trustScore` (manual adjustment if needed)

Example request:
```json
{
  "firstName": "John",
  "xp": 5000,
  "trustScore": 4.5,
  "bio": "Updated bio"
}
```

#### User Deletion

**Delete user and linked auth account**
```
DELETE /user/admin/profiles/:profileId
```
Permanently removes the user's profile and authentication record. This is irreversible.

#### XP Management

**Award XP to a user**
```
POST /user/admin/profiles/:profileId/xp/events
```
Body:
```json
{
  "eventKey": "campaign_completed",
  "context": {
    "campaignId": "...",
    "difficulty": "hard",
    "district": "Kathmandu"
  }
}
```
Triggers the XP rule engine and awards calculated XP to user.

**Simulate XP without saving**
```
POST /user/admin/xp/simulate
```
Body:
```json
{
  "eventKey": "campaign_completed",
  "profileId": "...",
  "context": { ... }
}
```
Returns breakdown without modifying database.

**View XP history with pagination**
```
GET /user/admin/profiles/:profileId/xp/history?page=1&limit=20
```
Returns timestamped XP awards with breakdown details.

**Edit XP history entry**
```
PATCH /user/admin/profiles/:profileId/xp/history/:historyId
```
Body:
```json
{
  "points": 200,
  "reason": "Manual correction - duplicate award"
}
```

**Delete XP history entry**
```
DELETE /user/admin/profiles/:profileId/xp/history/:historyId
```
Body:
```json
{
  "reason": "Fraudulent award - campaign not actually completed"
}
```

#### Photo Verification Queue

**List pending photo verification requests**
```
GET /user/admin/photo-verification-requests?status=pending&page=1&limit=20
```
Query params: `status` — 'pending', 'approved', 'rejected', or 'all'

**Approve or reject a verification request**
```
PATCH /user/admin/profiles/:profileId/photos/verification-requests/:requestCode
```
Body:
```json
{
  "status": "approved",
  "adminComment": "Photo verified. Campaign markers visible."
}
```
On approval, XP is awarded to user.

#### Achievement Management

**Record achievement event for a user**
```
POST /user/admin/profiles/:profileId/achievements/events
```
Body:
```json
{
  "subcategory": "hikes",
  "count": 1
}
```
Tracks activity and unlocks achievements when targets are reached.

### User Validation Rules

When editing users, the admin panel enforces:

- **Age**: Calculated from dateOfBirth, must be 9-120 years old
- **Gender**: Must be 'male', 'female', or 'prefer_not_to_say'
- **ExperienceLevel**: Must be 'beginner', 'intermediate', 'advanced', or 'expert'
- **LanguagesKnown**: Array of trimmed, non-empty strings
- **Level**: Must be ≥1 (positive integer)
- **TrustScore**: Float between 0.0 and 5.0
- **ProfilePhoto**: Cloudinary URL or null

### Notes for Admin Frontend

1. **Denormalized Fields**: `xp`, `level`, `rank`, `trustScore` are cached in the user document for quick leaderboard queries. When you manually edit XP, the level/rank are recalculated.

2. **XP History**: Not stored in the user document by default but queried separately for performance. Each entry includes a `breakdown` object with components:
   - `baseXp` — Rule base value
   - `difficultyMultiplier` — Applied difficulty bonus
   - `explorationBonus` — First visit, new district, hidden gem bonuses
   - `socialBonus` — Host/social multiplier
   - `repeatMultiplier` — Penalty for repeat locations

3. **Admin Flags**: Tracks when admin content actions are taken (e.g., campaign deleted). Visible in the adminFlags array.

4. **Referral System**: Once set, a user's referrer cannot be changed. The `referralCode` is auto-generated and unique.

5. **Verified Host**: Automatically set to `true` when `totalHostedCampaigns ≥ 5` AND `trustScore ≥ 4.0`. Admin can manually override if needed.

6. **Photo Verification**: Photos are submitted by users before XP is awarded. Admin reviews and approves/rejects with comments. Approvals trigger XP awards.

7. **Device Tokens**: FCM tokens stored for push notifications. Max 5 per user; older ones are trimmed.

### See Also

For complete schema documentation, see [backend/SCHEMA.md](../backend/SCHEMA.md)

---

## Admin Trip Management

This section documents the Trip collection and admin endpoints for managing trips, participants, and check-ins.

### Trip Collection Structure

Each trip document contains:

#### Trip Identification
- `tripCode` — Unique code (TS-XXXXXX format)
- `title` — Trip name
- `description` — Trip details

#### Classification
- `activityType` — 'hike', 'trek', 'heritage', 'natural_resource', 'adventure', 'hidden_gems'
- `difficulty` — 'easy', 'moderate', 'difficult', 'expert'

#### Trip Status & Control
- `status` — 'draft', 'upcoming', 'ongoing', 'completed', 'cancelled'
- `joinMode` — 'open' (instant join) or 'approval_required'
- `isDeleted` — Soft-delete flag

#### Participant Management
- `maxParticipants` — Min 2, max 30
- `currentParticipantCount` — Count including host
- `waitlistEnabled` — Boolean
- `waitlistCount` — Pending/waitlisted count

#### Schedule
- `startDate` — When trip begins
- `endDate` — When trip ends (optional)
- `joinOpenUntil` — Deadline to join trip

#### Location (Geospatial)
- `locationGps` — GeoJSON Point {type: 'Point', coordinates: [lng, lat]}
- `province`, `district` — Location hierarchy
- `tags` — Max 5 tags for discovery

#### Safety & XP
- `xpAwarded` — Boolean flag (prevents double-award)

### Admin Trip Endpoints

#### Creating & Listing Trips

**Create a trip**
```
POST /trips
```
Body:
```json
{
  "title": "Langtang Valley Trek",
  "description": "3-day trek through mountain villages",
  "activityType": "trek",
  "difficulty": "moderate",
  "joinMode": "approval_required",
  "maxParticipants": 15,
  "startDate": "2026-05-15T06:00:00Z",
  "endDate": "2026-05-17T18:00:00Z",
  "joinOpenUntil": "2026-05-10T23:59:59Z",
  "province": "Bagmati",
  "district": "Kathmandu",
  "locationGps": {
    "type": "Point",
    "coordinates": [85.3456, 28.1234]
  },
  "tags": ["langtang", "trek", "valley"],
  "waitlistEnabled": true
}
```

**List all trips with filters**
```
GET /trips?status=upcoming&activityType=trek&difficulty=moderate&page=1&limit=20
```

**Geospatial search** (find trips within radius)
```
GET /trips?lng=85.3456&lat=28.1234&maxDistance=50000
```
maxDistance in meters (default 50km).

**Get trip details**
```
GET /trips/:tripId
```

#### Updating Trips

**Update trip details**
```
PATCH /trips/:tripId
```
Updateable fields:
- `title`, `description`
- `difficulty`, `joinMode`
- `maxParticipants`, `waitlistEnabled`
- `startDate`, `endDate`, `joinOpenUntil`
- `province`, `district`, `locationGps`
- `tags`
- `status`, `cancellationReason` (when status=cancelled)

**Delete trip** (soft-delete)
```
DELETE /trips/:tripId
```
Admin only. Marks as `isDeleted: true`.

#### Participant Management

**List trip participants (paginated)**
```
GET /trips/:tripId/participants?page=1&limit=20
```

**Approve/reject/remove a participant**
```
PATCH /trips/:tripId/participants/:userId/approve
```
Body:
```json
{
  "status": "approved",
  "reason": "Optional explanation"
}
```
Status options: `approved`, `rejected`, `removed`

**Confirm trip completion for participants**
```
POST /trips/:tripId/confirm-completion
```
Body (optional):
```json
{
  "userIds": ["userId1", "userId2"]
}
```
If `userIds` is omitted, marks all approved participants as completed. Sets `xpAwarded` flag to `false` to allow XP awarding.

### Participant Tracking

Each participant record (`TripParticipants` collection) contains:

- `status` — 'pending', 'approved', 'rejected', 'removed'
- `completionConfirmed` — Boolean flag set after admin confirmation
- `joinedAt` — When approved/joined
- `lastCheckinAt` — Last check-in timestamp (for multi-day trips)
- `missedCheckins` — Counter for safety monitoring

### Admin Workflow for Trips

**Typical admin steps:**

1. **Create trip** — POST /trips with all details and geolocation
2. **Review participants** — GET /trips/:tripId/participants as they join
3. **Manage joinMode**:
   - `open`: Users auto-approved immediately
   - `approval_required`: Admin approves each request via PATCH /approve
4. **Handle waitlist** — If `waitlistEnabled=true`, when a participant cancels, auto-promote next waitlisted user
5. **Trip day** — Users POST /trips/:tripId/checkin to mark attendance
6. **After trip** — POST /trips/:tripId/confirm-completion to mark participants as completed
7. **Award XP** — Trigger XP rules for completed participants (linked to UserService)

### Geospatial Queries

Trips support MongoDB geospatial queries via the `locationGps` field (2dsphere index):

```javascript
// Find trips within 50km of user's location
GET /trips?lng={lng}&lat={lat}&maxDistance=50000

// Returns trips ordered by distance
```

Frontend can use this for "nearby trips" discovery.

### Validation & Constraints

- **Trip codes**: Auto-generated as TS-XXXXXX, unique per trip
- **Max participants**: 2-30 range enforced
- **Date constraints**:
  - `endDate` must be after `startDate` (if both provided)
  - `joinOpenUntil` must be ≤ `startDate`
- **Status transitions**: 
  - draft → upcoming/ongoing → completed/cancelled
- **XP safety**: `xpAwarded` flag prevents double-award if rules are re-run

### Admin Frontend Considerations

1. **Geospatial map**: Integrate with Mapbox/Google Maps to visualize trip locations and search radius
2. **Participant approval queue**: Filter by `status=pending` to show awaiting approvals
3. **Check-in tracking**: Display `lastCheckinAt` and `missedCheckins` for multi-day trips
4. **Waitlist management**: Show pending/waitlisted vs approved participant counts
5. **Trip lifecycle**: Color-code by status (draft=gray, upcoming=blue, ongoing=green, completed=gold, cancelled=red)
6. **Batch actions**: Approve/reject multiple participants, confirm completion for groups

### Key Differences from Campaign Collection

Trips are the **new, enhanced** trip management system. Key improvements over Campaign:

| Feature | Campaign | Trips |
|---------|----------|-------|
| Geolocation | District/province string | GeoJSON Point + 2dsphere index |
| Participant approval | Implicit | Explicit join mode control |
| Waitlist | Not supported | Full waitlist management |
| Check-ins | Not tracked | Tracked per-participant |
| Soft delete | Yes | Yes |
| XP safety flag | No | Yes (xpAwarded) |

**Migration note**: Campaign and Trips will coexist. Eventually migrate existing campaigns to trips or deprecate Campaign in favor of Trips.

### See Also

For complete schema documentation, see [backend/SCHEMA.md](../backend/SCHEMA.md)

---

## Admin Achievement Management

This section documents the Achievement system for gamification, including how to define, manage, and track user achievements.

### Achievement System Overview

The achievement system consists of two collections:

1. **AchievementDefinition** — Admin-created achievement templates with flexible condition logic
2. **UserAchievement** — Per-user achievement progress and unlock history

Achievements reward players for specific actions and milestones (visiting districts, hosting trips, gaining XP, etc.) with:
- Progress tracking toward goals
- XP rewards on unlock
- Optional badge grants
- Repeatable achievements with configurable max completions

### AchievementDefinition Schema

Each achievement template contains:

#### Identity & Metadata
- `code` — Unique identifier (e.g., 'DISTRICT_10', 'TREK_MASTER', 'SOCIAL_BUTTERFLY')
- `name` — Human-readable name
- `category` — 'exploration', 'hosting', 'skill', 'social', 'special'
- `description` — What player must do to unlock
- `iconUrl` — Asset URL for UI display

#### Condition Logic
- `conditionType` — 'count', 'value', or 'event'
- `conditionField` — User field to track (e.g., 'xp', 'districtsVisited', 'totalHostedCampaigns', 'level')
- `conditionOperator` — Comparison operator: 'gte' (≥), 'gt' (>), 'eq' (=), 'lte' (≤), 'lt' (<)
- `conditionValue` — Target value (e.g., need XP ≥ 5000)

#### Optional Filtering
- `filterField` — (Optional) Field to filter on (e.g., 'activityType')
- `filterValue` — (Optional) Value to filter by (e.g., 'trek')

#### Rewards & Lifecycle
- `xpReward` — XP awarded when unlocked
- `badgeCode` — Optional badge identifier to grant on unlock
- `isActive` — Whether achievement is offered to players
- `isRepeatable` — Can be unlocked multiple times
- `maxCompletions` — (Optional) Max times it can be unlocked

### Admin Achievement Endpoints

#### Creating Achievements

**Create a new achievement**
```
POST /achievements
```
Body:
```json
{
  "code": "DISTRICT_10",
  "name": "District Explorer",
  "description": "Visit 10 different districts",
  "category": "exploration",
  "conditionType": "count",
  "conditionField": "districtsVisited",
  "conditionOperator": "gte",
  "conditionValue": 10,
  "xpReward": 500,
  "badgeCode": "EXPLORER_BADGE",
  "isActive": true,
  "isRepeatable": false
}
```

#### Listing & Viewing Achievements

**List all achievements with filters**
```
GET /achievements?category=exploration&isActive=true&page=1&limit=20
```
Query parameters:
- `category` — Filter by category (optional)
- `isActive` — Filter active/inactive (optional)
- `page` — Pagination page (default: 1)
- `limit` — Results per page (default: 20)

**Get single achievement**
```
GET /achievements/:achievementId
```

#### Updating Achievements

**Update achievement definition**
```
PATCH /achievements/:achievementId
```
All fields except `code` are updatable. Example:
```json
{
  "name": "Updated Name",
  "xpReward": 600,
  "isActive": false
}
```

#### Deleting Achievements

**Delete achievement** (also deletes all user progress)
```
DELETE /achievements/:achievementId
```

### User Achievement Endpoints

#### Viewing User Achievements

**Get all achievements for a user with progress**
```
GET /achievements/users/:userId
```
Response includes:
- List of all active achievements
- User's progress on each (0-100%)
- Completion status and date
- Times completed (for repeatable achievements)
- Total completion percentage

Example response:
```json
{
  "userId": "...",
  "totalAchievements": 25,
  "completedAchievements": 8,
  "completionPercentage": 32,
  "achievements": [
    {
      "achievementId": "...",
      "code": "DISTRICT_10",
      "name": "District Explorer",
      "category": "exploration",
      "progress": 7,
      "conditionValue": 10,
      "progressPercentage": 70,
      "isCompleted": false,
      "xpReward": 500,
      "timesCompleted": 0
    }
  ]
}
```

**Get specific user achievement progress**
```
GET /achievements/users/:userId/:achievementId
```

### Admin Achievement Management

#### Manual Achievement Actions

**Reset user achievement progress** (admin only)
```
POST /achievements/admin/users/:userId/reset/:achievementId
```
Resets a user's progress on an achievement back to 0, uncompleted state.

**Get achievement categories** (admin only)
```
GET /achievements/admin/categories
```
Returns list of all valid achievement categories.

### Achievement Unlock Logic

Achievements unlock when a user's tracked field meets or exceeds the condition:

```javascript
// Examples:
conditionField: "xp", conditionValue: 1000, conditionOperator: "gte"
// Unlocks when user.xp >= 1000

conditionField: "totalHostedCampaigns", conditionValue: 5, conditionOperator: "gte"
// Unlocks when user.totalHostedCampaigns >= 5

conditionField: "level", conditionValue: 10, conditionOperator: "eq"
// Unlocks when user.level === 10

conditionField: "streakCurrentDays", conditionValue: 30, conditionOperator: "gte"
// Unlocks when user.streakCurrentDays >= 30
```

### Repeatable vs One-Time Achievements

**One-time achievements** (`isRepeatable: false`):
- Unlock once and stay unlocked
- Award XP once

**Repeatable achievements** (`isRepeatable: true`, optional `maxCompletions`):
- Can be unlocked multiple times as conditions are re-checked
- `maxCompletions` limits total unlocks (null = unlimited)
- Each re-unlock awards XP
- Track `timesCompleted` and `lastCompletedAt`

Example: "Hike 5 trips" can be unlocked every time the user completes 5 trips (repeatable, `maxCompletions: null`).

### Achievement Checking & Updates

Achievements are checked and updated after significant user events:

**Triggered by:**
- User completing a campaign/trip
- User gaining XP
- User leveling up
- Admin manually triggering check

**Called from:**
- `CampaignService.completeCampaign()` — checks achievements after campaign completion
- `UserService.awardXp()` — checks achievements after XP award
- Manual admin invocation — `/achievements/admin/users/:userId/check`

**Service method:**
```typescript
// In backend/src/achievement/achievement.service.ts
async checkAndUpdateAchievements(userId: string, userStats: any): Promise<{
  unlockedAchievements: string[];
  xpAwarded: number;
}>
```

### Admin Frontend Components

#### AchievementManager Component
Location: [Admin/components/achievement-manager.tsx](components/achievement-manager.tsx)

Features:
- Create, edit, list, and delete achievement definitions
- Filter by category
- Visual status indicators (active/inactive, repeatable)
- Form validation

#### UserAchievementsDisplay Component
Location: [Admin/components/user-achievements-display.tsx](components/user-achievements-display.tsx)

Features:
- Display all achievements for a user
- Progress bars with percentage tracking
- Filter by category
- Toggle completed/in-progress
- Show unlock dates and repeat counts
- Visual category icons and progress colors

### Built-in Achievement Categories

1. **Exploration** 🗺️
   - District/location-based unlocks
   - Examples: 'DISTRICT_5', 'DISTRICT_10', 'ALL_DISTRICTS'

2. **Hosting** 🏕️
   - Campaign/trip hosting milestones
   - Examples: 'HOST_5_CAMPAIGNS', 'VERIFIED_HOST', 'LEGEND_HOST'

3. **Skill** ⚡
   - Difficulty and activity type mastery
   - Examples: 'TREK_MASTER', 'EXPERT_HIKER', 'VARIETY_ADVENTURER'

4. **Social** 👥
   - Referrals, ratings, team activities
   - Examples: 'SOCIAL_BUTTERFLY', 'TOP_RATED_HOST', '5_REFERRALS'

5. **Special** ⭐
   - Limited-time events, seasonal, or unique challenges
   - Examples: 'MONSOON_WARRIOR', 'WINTER_CHALLENGER', 'FIRST_SUMMIT'

### Example Achievement Setup

**Scenario: Create achievements for a new user tier system**

```
Achievement 1: Newbie Explorer
- code: NEWBIE
- conditionField: xp
- conditionValue: 100
- xpReward: 50
- category: exploration

Achievement 2: District Master
- code: DISTRICT_5
- conditionField: districtsVisited
- conditionValue: 5
- xpReward: 200
- category: exploration

Achievement 3: Verified Host
- code: VERIFIED_HOST
- conditionField: totalHostedCampaigns
- conditionValue: 5
- conditionOperator: gte
- xpReward: 500
- category: hosting

Achievement 4: Social Butterfly
- code: SOCIAL_BUTTERFLY
- conditionField: totalRatingsReceived
- conditionValue: 10
- xpReward: 150
- category: social
- isRepeatable: true
- maxCompletions: null
```

### Best Practices

1. **Balance Rewards**: Align XP rewards with difficulty. Harder achievements should award more XP.
2. **Clear Progression**: Design achievement chains (e.g., Newbie → Explorer → Master).
3. **Avoid Overlap**: Ensure conditions don't create conflicting achievements.
4. **Regular Reviews**: Monitor unlock rates and adjust difficulty if too easy/hard.
5. **Fresh Content**: Add seasonal/special achievements to maintain engagement.
6. **Clear Descriptions**: Users should understand what's required to unlock.

### See Also

For complete schema documentation, see [backend/SCHEMA.md](../backend/SCHEMA.md)
For backend implementation, see [backend/src/achievement/](../backend/src/achievement/)
