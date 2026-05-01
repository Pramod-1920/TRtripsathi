# Backend Database Schema

This document describes the MongoDB collections and their current implementation status in the TRtripsathi backend.

## Collections Overview

```
Auth (authentication credentials)
├─ User (profile + gamification)
├─ Campaign (legacy trip/hike management)
├─ Trips (NEW: enhanced trip management with geolocation)
│  └─ TripParticipants (trip membership and check-ins)
├─ ExtraItem (configurable rules and settings)
├─ AuditLog (event logging - optional S3 backup)
├─ AchievementDefinition (admin-created achievement templates)
│  └─ UserAchievement (per-user achievement progress)
└─ [Future: Ratings, PhotoVerificationRequests, XpHistory]
```

---

## 1. Auth Collection

**Status:** ✅ Fully Implemented

Stores login credentials and account security state. Separate from user profile.

```typescript
{
  _id: ObjectId [pk],
  
  // Credentials
  phoneNumber: string [not null, unique, note: "E.164 format"],
  password: string [not null, note: "bcrypt hash – select:false"],
  email: string [nullable, note: "optional, sparse unique index"],
  
  // Authorization
  role: string [not null, note: "'user' or 'admin' – default 'user'"],
  
  // Session & Security
  refreshTokens: [
    {
      hash: string [note: "bcrypt hash of refresh token"],
      createdAt: datetime [note: "when token was issued"]
    }
  ] [note: "max 3 sessions (configurable); newer tokens pushed to front"],
  
  failedLoginAttempts: number [default: 0, note: "select:false"],
  lockUntil: datetime [nullable, note: "account locked until this time – select:false"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    phoneNumber: unique,
    email: [sparse, unique]
  }
}
```

---

## 2. User Collection

**Status:** ✅ Core Profile & Gamification Implemented | 🔄 Ratings/Achievements/PhotoVerification Embedded

Stores user profile, location, and gamification state. Linked to Auth by `authId`.

```typescript
{
  _id: ObjectId [pk],
  
  // Link to Auth
  authId: ObjectId [ref: > Auth._id, not null, unique],
  
  // Profile Status
  profileCompleted: boolean [default: false],
  
  // Personal Info
  firstName: string [nullable],
  middleName: string [nullable],
  lastName: string [nullable],
  dateOfBirth: datetime [nullable, note: "date only"],
  age: number [calculated from dateOfBirth, nullable],
  gender: string [nullable, note: "'male','female','prefer_not_to_say'"],
  
  // Profile Photo
  profilePhoto: string [nullable, note: "Cloudinary URL"],
  profilePhotoPublicId: string [nullable, note: "for cleanup on replace"],
  
  // Bio & Public Profile
  bio: string [nullable],
  isProfilePublic: boolean [default: true],
  
  // Location
  location: string [nullable, note: "computed from province/district/placeName"],
  province: string [nullable],
  district: string [nullable],
  landmark: string [nullable],
  
  // Experience
  experienceLevel: string [nullable, note: "'beginner','intermediate','advanced','expert'"],
  languagesKnown: [string] [default: [], note: "array of languages"],
  
  // Gamification – XP & Level
  xp: number [default: 0],
  level: number [default: 1],
  nextLevelXp: number [calculated, default: 1000],
  rank: string [calculated, note: "'noice','f','e','d','c','b','a','s','ss','sss','mystic'"],
  rankTitle: string [nullable, note: "e.g. 'Wanderer'"],
  
  // Activity & Achievement Tracking
  xpHistory: [
    {
      _id: ObjectId,
      eventKey: string [note: "e.g. 'campaign_completed'"],
      points: number,
      breakdown: object [note: "base, difficulty, exploration, social, repeat multipliers"],
      context: object [note: "campaign, district, difficulty, etc."],
      createdAt: datetime,
      createdBy: string [note: "user | admin"]
    }
  ] [note: "paginated reads via separate query"],
  
  achievementCounts: object [note: "{hikes:0, treks:0, temples:0, difficult_routes:0, legendary_routes:0, quest_chains:0}"],
  totalCompletedCampaigns: number [default: 0],
  totalHostedCampaigns: number [default: 0],
  
  // Referral & Social
  referrerId: ObjectId [nullable, ref: > User._id, note: "one-time set"],
  referralCode: string [nullable, unique, note: "8-char for inviting others"],
  totalReferralCompletions: number [default: 0, note: "referees who completed campaigns"],
  
  // Trust & Ratings
  trustScore: float [default: 0, note: "average of ratings received"],
  totalRatingsReceived: number [default: 0],
  isVerifiedHost: boolean [default: false, note: "set when totalHosted>=5 AND trustScore>=4.0"],
  
  // Ratings Received (denormalized for quick access)
  ratings: [
    {
      _id: ObjectId,
      fromUserId: ObjectId [ref: > User._id],
      stars: number [note: "1-5"],
      comment: string [nullable],
      createdAt: datetime
    }
  ] [note: "optional denormalization; can be queried separately"],
  
  // Photo Verification Requests
  photoVerificationRequests: [
    {
      _id: ObjectId,
      requestCode: string [unique within user, note: "for admin review linking"],
      campaignId: ObjectId [ref: > Campaign._id],
      photoUrl: string [note: "Cloudinary URL"],
      photoPublicId: string,
      status: string [note: "'pending','approved','rejected'"],
      submittedAt: datetime,
      reviewedAt: datetime [nullable],
      reviewedBy: ObjectId [nullable, ref: > Auth._id],
      adminComment: string [nullable]
    }
  ] [note: "tracks campaign photo verification before XP award"],
  
  // Streaks & Exploration
  streakCurrentDays: number [default: 0],
  streakMaxDays: number [default: 0],
  districtsVisited: number [default: 0, note: "count of unique districts completed"],
  
  // Device & Notifications
  deviceTokens: [string] [note: "FCM tokens, max 5"],
  notificationPrefs: object [not null, note: "{chat:true, tripReminder:true, joinRequest:true, xpAward:true, emergency:true}"],
  
  // Admin Flags (denormalized metadata)
  adminFlags: [
    {
      type: string [note: "e.g. 'campaign_deleted'"],
      campaignId: ObjectId [nullable],
      reason: string [nullable],
      date: datetime
    }
  ] [note: "tracks admin actions against user's content"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    authId: unique,
    referrerId: [sparse],
    referralCode: [sparse, unique],
    trustScore: descending [note: "leaderboard queries"],
    xp: descending [note: "leaderboard queries"],
    (province, district): [name: "geo_filter"]
  }
}
```

---

## 3. Campaign Collection

**Status:** ✅ Fully Implemented

Stores trip/campaign instances.

```typescript
{
  _id: ObjectId [pk],
  
  // Identity & Metadata
  campaignCode: string [unique, note: "CMP-xxxxxx"],
  title: string [not null],
  description: string [nullable],
  
  // Scheduling
  scheduleType: string [not null, note: "'scheduled' or 'instant'"],
  startDate: datetime [nullable],
  endDate: datetime [nullable],
  joinOpenDate: datetime [nullable],
  durationDays: number [default: 1],
  
  // Classification
  category: string [not null, note: "activity type – validated against extras.activities"],
  hikeType: string [not null, note: "'solo' or 'group'"],
  difficulty: string [nullable, note: "'easy','moderate','hard','extreme'"],
  
  // Location
  location: string [nullable, note: "display location"],
  province: string [nullable],
  district: string [nullable],
  placeName: string [nullable],
  
  // Content
  bannerImageUrl: string [nullable],
  bannerImagePublicId: string [nullable],
  
  // Host & Participation
  hostId: ObjectId [ref: > Auth._id, not null],
  participants: [
    {
      userId: ObjectId [ref: > User._id],
      status: string [note: "'pending','accepted','rejected','cancelled'"],
      joinedAt: datetime
    }
  ],
  
  // State
  completed: boolean [default: false, note: "auto-set when now >= endDate or via admin"],
  deletedByAdmin: boolean [default: false, note: "soft-delete marker"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    campaignCode: unique,
    hostId: [note: "queries by host"],
    (startDate, completed): [note: "listing/auto-close"],
    district: [note: "geo filtering"]
  }
}
```

---

## 4. Trips Collection

**Status:** 🔄 Implementation In Progress

Enhanced trip/expedition management with geolocation, waitlist, and check-in tracking.

```typescript
{
  _id: ObjectId [pk],
  
  // Identity & Code
  tripCode: string [unique, not null, note: "TS-XXXXXX format"],
  
  // Host
  hostId: ObjectId [ref: > User._id, not null],
  
  // Trip Details
  title: string [not null],
  description: string [nullable],
  activityType: string [not null, note: "'hike','trek','heritage','natural_resource','adventure','hidden_gems'"],
  difficulty: string [not null, note: "'easy','moderate','difficult','expert'"],
  
  // Status & Access
  status: string [not null, note: "'draft','upcoming','ongoing','completed','cancelled'"],
  joinMode: string [not null, note: "'open' (instant) or 'approval_required'"],
  
  // Participant Limits
  maxParticipants: number [not null, note: "min 2, max 30"],
  currentParticipantCount: number [default: 1, note: "includes host"],
  waitlistEnabled: boolean [default: false],
  waitlistCount: number [default: 0],
  
  // Schedule
  startDate: datetime [not null],
  endDate: datetime [nullable],
  joinOpenUntil: datetime [nullable, note: "deadline to join"],
  
  // Location (Geospatial)
  province: string [nullable],
  district: string [nullable],
  locationGps: object [not null, note: "GeoJSON Point {type:'Point', coordinates:[lng,lat]}"],
  
  // Metadata
  tags: [string] [note: "max 5 tags"],
  
  // XP & Completion Safety
  xpAwarded: boolean [default: false, note: "prevents double-award of XP"],
  
  // Soft Delete
  isDeleted: boolean [default: false],
  cancellationReason: string [nullable, note: "required when status='cancelled'"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    tripCode: unique,
    locationGps: [note: "2dsphere index for geospatial queries"],
    (status, startDate): [name: "status_start"],
    hostId: [note: "queries by host"],
    (activityType, difficulty, status): [name: "discovery"],
    (district, status): [name: "district_search"],
    (isDeleted, status, startDate): [name: "soft_delete_aware"]
  }
}
```

---

## 5. TripParticipants Collection

**Status:** 🔄 Implementation In Progress

Tracks membership and engagement in trips (replaces inline participants array for better querying).

```typescript
{
  _id: ObjectId [pk],
  
  // References
  tripId: ObjectId [ref: > Trips._id, not null],
  userId: ObjectId [ref: > User._id, not null],
  
  // Status
  status: string [not null, note: "'pending','approved','rejected','removed'"],
  completionConfirmed: boolean [default: false, note: "admin confirms user completed trip"],
  
  // Engagement
  joinedAt: datetime [nullable, note: "when user joined/was approved"],
  lastCheckinAt: datetime [nullable, note: "last check-in timestamp"],
  missedCheckins: number [default: 0, note: "multi-day trip safety tracking"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (tripId, userId): [unique, name: "unique_membership"],
    (userId, status): [name: "user_status"],
    (tripId, status): [name: "trip_status"],
    lastCheckinAt: [name: "checkin_cron"]
  }
}
```

---

## 6. ExtraItem Collection

**Status:** ✅ Fully Implemented

Flexible configuration system for rules, settings, and enumerations.

```typescript
{
  _id: ObjectId [pk],
  
  // Identity
  extraCode: string [unique, note: "EXT-xxxxxx"],
  category: string [not null, note: "'xp','achievement','activity','level_up','difficulty'"],
  name: string [not null],
  description: string [nullable],
  
  // Flexible Value Storage
  value: string [nullable, note: "JSON stringified rule/config"],
  enabled: boolean [default: true],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    extraCode: unique,
    (category, enabled): [note: "rule lookups"]
  }
}
```

### ExtraItem Value Schemas by Category:

**Category: `xp`** (XP Rules)
```json
{
  "eventKey": "campaign_completed",
  "ruleType": "activity|location|global|social",
  "baseXp": 100,
  "overrideXp": 150,
  "bonusXp": 25,
  "socialBonusXp": 50,
  "difficultyMultipliers": { "easy": 1, "moderate": 1.3, "hard": 1.8, "extreme": 2.4 },
  "explorationBonuses": { "firstVisit": 150, "newDistrict": 250, "hiddenGem": 300, "rareRoute": 400 },
  "repeat": "always|once_per_user|once_per_campaign|once_per_district|once_per_difficulty|once_per_referred_user",
  "conditions": {
    "difficulty": "easy",
    "district": "kathmandu",
    "solo": false,
    "hostOnly": false,
    "ratingGte": 4
  }
}
```

**Category: `achievement`** (Achievement Definitions)
```json
{
  "key": "hikes_10",
  "subcategory": "hikes",
  "targetCount": 10,
  "title": "Hike Master",
  "description": "Complete 10 hikes",
  "hidden": false,
  "rewardXp": 500,
  "badge": "hike_master"
}
```

**Category: `level_up`** (Rank Progression Rules)
```json
{
  "rankCode": "f",
  "requiredXp": 5000,
  "title": "Tier F Wanderer",
  "feeling": "Getting serious!",
  "requireRank": "e",
  "hidden": false,
  "requirements": {
    "hikes": 5,
    "treks": 2,
    "temples": 1
  }
}
```

---

## 7. AuditLog Collection (Optional — Can use S3 instead)

**Status:** ✅ Implemented (local file + optional S3)

Immutable event log for compliance and security auditing.

```typescript
{
  // Local file: logs/audit.log (JSONL format)
  // Each line: { timestamp, type, userId, ip, ua, ... }
  
  type: string [note: "auth.signup, auth.login, auth.failed_login, campaign.create, admin.delete_profile, etc."],
  userId: string [nullable],
  ip: string [nullable],
  ua: string [nullable, note: "user-agent"],
  details: object [nullable],
  timestamp: datetime [not null],
  
  // Optional S3 Backend
  // If AUDIT_S3_BUCKET is set:
  // - Each event is uploaded to: s3://{bucket}/audit/{YYYY-MM-DD}/{timestamp}-{uuid}.json
  // - Immutable once written
}
```

---

## 6. AchievementDefinition Collection

**Status:** 🔄 Implementation In Progress

Admin-created achievement templates with flexible condition logic.

```typescript
{
  _id: ObjectId [pk],
  
  // Identity
  code: string [unique, not null, note: "e.g. 'DISTRICT_10', 'HIKES_50', 'TREK_MASTER'"],
  name: string [not null, note: "Human-readable name"],
  description: string [nullable, note: "What player must do to unlock"],
  
  // Classification
  category: string [not null, note: "'exploration','hosting','skill','social','special'"],
  iconUrl: string [nullable, note: "Asset URL for achievement icon/badge"],
  
  // Condition Logic
  conditionType: string [not null, note: "'count','value','event' – how to measure progress"],
  conditionField: string [not null, note: "User field to track: 'districtsVisited','totalCompletedCampaigns','totalHostedCampaigns','xp','level','streakCurrentDays', activity counts, etc."],
  conditionOperator: string [default: 'gte', note: "'gte' (>=), 'eq', 'lte' (<=), 'gt', 'lt'"],
  conditionValue: number [not null, note: "target value or count"],
  
  // Optional Filtering
  filterField: string [nullable, note: "e.g. 'activityType' – filter achievements to specific conditions"],
  filterValue: string [nullable, note: "e.g. 'trek' – only count treks"],
  
  // Rewards
  xpReward: number [default: 0, note: "XP awarded on unlock"],
  badgeCode: string [nullable, note: "badge identifier (e.g. 'EXPLORER_BADGE')"],
  
  // Lifecycle
  isActive: boolean [default: true, note: "inactive achievements not offered to players"],
  isRepeatable: boolean [default: false, note: "can be unlocked multiple times"],
  maxCompletions: number [nullable, note: "if repeatable, max times it can be unlocked (null = unlimited)"],
  
  // Metadata
  createdBy: ObjectId [not null, ref: > Auth._id, note: "admin user who created it"],
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    code: unique,
    isActive: [note: "filter active achievements"],
    category: [note: "filter by category"],
    (isActive, category): [name: "active_category"]
  }
}
```

---

## 7. UserAchievement Collection

**Status:** 🔄 Implementation In Progress

Tracks per-user achievement progress and unlock history.

```typescript
{
  _id: ObjectId [pk],
  
  // References
  userId: ObjectId [not null, ref: > User._id],
  achievementId: ObjectId [not null, ref: > AchievementDefinition._id],
  
  // Progress Tracking
  progress: number [default: 0, note: "current value of conditionField for this user"],
  isCompleted: boolean [default: false, note: "achievement unlocked"],
  completedAt: datetime [nullable, note: "when achievement was unlocked"],
  
  // Repeatable Achievement Tracking
  timesCompleted: number [default: 0, note: "how many times user has unlocked this achievement"],
  lastCompletedAt: datetime [nullable, note: "last time achievement was unlocked"],
  
  // Audit
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (userId, achievementId): [unique, name: "unique_user_achievement"],
    (userId, isCompleted): [name: "user_completed"],
    userId: [note: "fetch all achievements for user"],
    isCompleted: [note: "find unlocked achievements"]
  }
}
```

---

## 8. Collections NOT Yet in Backend (Planned)

### Option A: Separate Collections (Recommended)

**XpHistory** (Separate collection for better querying)
```typescript
{
  _id: ObjectId [pk],
  userId: ObjectId [ref: > User._id, not null],
  eventKey: string,
  points: number,
  breakdown: object,
  context: object,
  createdAt: datetime,
  createdBy: string,
  indexes: {
    userId: [note: "fetch user's history"],
    createdAt: [note: "time-range queries"]
  }
}
```

**Rating** (Separate collection)
```typescript
{
  _id: ObjectId [pk],
  fromUserId: ObjectId [ref: > User._id, not null],
  toUserId: ObjectId [ref: > User._id, not null],
  campaignId: ObjectId [ref: > Campaign._id],
  stars: number,
  comment: string [nullable],
  createdAt: datetime,
  indexes: {
    toUserId: [note: "ratings for a user"],
    (fromUserId, toUserId, campaignId): unique [note: "one rating per user per campaign"]
  }
}
```

### Option B: Embedded in User (Current Implementation)

Fields are denormalized into the User document for fast reads:
- `xpHistory` array (paginated in queries)
- `achievementCounts` object and achievement array
- `ratings` array (received ratings)
- `photoVerificationRequests` array

This provides O(1) user document reads but requires careful update management.

---

## 8. Migration & Implementation Roadmap

### Currently Deployed ✅
- Auth collection (signup, login, logout, token rotation)
- User collection (profile, XP, level, references)
- Campaign collection (CRUD, auto-close with XP awards)
- ExtraItem collection (XP rules, achievements, activities)
- Audit logging (local file + optional S3)

### In Progress 🔄
- **Trips collection** (enhanced trip management with geolocation and waitlist)
- **TripParticipants collection** (membership tracking with check-ins)
- Trip endpoints: create, list, details, update, delete, join, check-in
- Geospatial queries for nearby trips
- Waitlist management
- Check-in tracking for multi-day trips

### Ready to Extend 🔄
- Separate XpHistory collection (for better pagination/analytics)
- Separate Achievement tracking collection
- Separate Rating collection
- Enhanced photo verification workflow
- Trust scoring refinement
- Verified host badge logic

### Future Considerations 📋
- Multi-currency support for premium features
- Social features (followers, chat, notifications)
- Badge system with visual assets
- Leaderboard caching with Redis
- Advanced search and discovery
- Post-trip feedback forms
- Insurance/liability integrations

---

## 9. Notes on Implementation

### Field Selection (`select: false`)
Some fields are sensitive and excluded by default:
- `Auth.password`
- `Auth.refreshTokens` (hashes)
- `Auth.failedLoginAttempts`, `lockUntil`
- `User.xpHistory` (paginated separately)

Use `.select('+fieldName')` in Mongoose queries to include them.

### Geospatial Queries (Trips Collection)
The `locationGps` field uses a GeoJSON Point with a 2dsphere index for efficient geospatial queries:
```javascript
// Find trips within 50km of user's location
db.trips.find({
  locationGps: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: 50000 // meters
    }
  }
})
```

### Indexes
All unique fields have indexes. Compound indexes support common query patterns:
- `(province, district)` for geographic filtering
- `(category, enabled)` on extras for rule lookups
- `xp DESC` and `trustScore DESC` for leaderboards
- `2dsphere` on `trips.locationGps` for geospatial queries
- `(status, startDate)` on trips for listing/filtering
- `(isDeleted, status, startDate)` on trips for soft-delete-aware queries

### Data Validation
- Email validation and uniqueness (sparse index allows nulls)
- Phone number format E.164 validation at service layer
- Age calculation and bounds (9-120 years)
- Gender enum validation
- Bcrypt password hashing
- Trip code format (TS-XXXXXX) validation
- Max participants bounds (2-30)
- Activity type and difficulty enum validation

### Denormalization Strategy
Selected fields are denormalized in User for O(1) access:
- `xp`, `level`, `rank` (frequently read for leaderboards/display)
- `trustScore`, `totalRatingsReceived` (frequently read for host verification)
- `achievementCounts` (quick overview without detailed lookup)

Detailed history (`xpHistory`, `ratings`, `photoVerificationRequests`) can remain embedded or be queried separately depending on access patterns.

---

## 9. Review Collection

**Status:** ✅ Fully Implemented

Stores peer reviews for users who completed trips together.

```typescript
{
  _id: ObjectId [pk],
  
  // References
  reviewerId: ObjectId [ref: > User._id, not null],
  revieweeId: ObjectId [ref: > User._id, not null],
  tripId: ObjectId [ref: > Trip._id, not null],
  
  // Review Data
  rating: number [not null, min: 1, max: 5, note: "1.0 to 5.0 stars"],
  comment: string [maxlength: 500],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (reviewerId, revieweeId, tripId): [unique, note: "one review per reviewer per reviewee per trip"],
    revieweeId: [-1, createdAt: -1, note: "fetch reviews for user"],
    reviewerId: [note: "fetch reviews given by user"]
  }
}
```

**Trust Score Calculation:**
- `User.trustScore = average of all reviews received`
- Updated after each review creation/update
- Used for `isVerifiedHost` badge (≥5 reviews AND ≥4.0 rating)

---

## 10. Report Collection

**Status:** ✅ Fully Implemented

Stores user/trip reports for moderation and safety.

```typescript
{
  _id: ObjectId [pk],
  
  // Report Details
  reporterId: ObjectId [ref: > User._id, not null],
  targetId: ObjectId [not null, note: "ObjectId of user or trip being reported"],
  targetType: string [not null, enum: "user|trip"],
  
  reason: string [not null, enum: "harassment|spam|inappropriate_content|safety_concern|fraud|other"],
  description: string [not null, minlength: 20, maxlength: 500],
  
  // Moderation
  status: string [not null, enum: "open|investigating|resolved|dismissed"],
  assignedTo: ObjectId [nullable, ref: > User._id, note: "Moderator assigned to report"],
  resolution: string [nullable, note: "Admin comment/resolution"],
  resolvedAt: datetime [nullable],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (status, createdAt): [-1, note: "moderation queue"],
    (targetId, targetType): [note: "reports for a target"],
    reporterId: [note: "reports by user"],
    (assignedTo, status): [note: "moderator dashboard"]
  }
}
```

---

## 11. Notification Collection

**Status:** ✅ Fully Implemented

Stores in-app notifications with TTL expiration.

```typescript
{
  _id: ObjectId [pk],
  
  // Recipient
  userId: ObjectId [ref: > User._id, not null],
  
  // Notification Content
  type: string [not null, enum: "trip_joined|trip_approved|trip_rejected|trip_started|trip_completed|review_received|message_received|achievement_unlocked|xp_awarded|level_up|admin_message|safety_alert"],
  title: string [not null],
  body: string [not null],
  data: object [nullable, note: "JSON with tripId, achievementId, etc."],
  
  // Status
  isRead: boolean [not null, default: false],
  
  // TTL
  createdAt: datetime [not null],
  expiresAt: datetime [not null, note: "30 days from creation"],
  
  indexes: {
    (userId, isRead, createdAt): [-1, note: "unread notifications"],
    (userId, createdAt): [-1, note: "all notifications"],
    expiresAt: [note: "TTL index: expireAfterSeconds 0"]
  }
}
```

---

## 12. Visited Place Collection

**Status:** ✅ Fully Implemented

Tracks which districts and provinces users have visited (via trip completion).

```typescript
{
  _id: ObjectId [pk],
  
  // Reference
  userId: ObjectId [ref: > User._id, not null],
  
  // Place Info
  placeCode: string [not null, note: "e.g., 'kathmandu', 'bhaktapur'"],
  placeType: string [not null, enum: "district|province"],
  visitedAt: datetime [not null],
  
  // Timestamp
  createdAt: datetime [not null],
  
  indexes: {
    (userId, placeCode): [unique],
    (userId, placeType): [note: "districts/provinces visited"]
  }
}
```

**Used For:**
- Achievement tracking ("visited 10 districts")
- User profile (explore map showing visited places)
- Exploration badges
- `User.districtsVisited` and `User.provincesCompleted` denormalized counts

---

## 13. XP Ledger Collection

**Status:** ✅ Fully Implemented

Immutable ledger tracking all XP awards and deductions per user.

```typescript
{
  _id: ObjectId [pk],
  
  // User Reference
  userId: ObjectId [ref: > User._id, not null],
  
  // XP Data
  xpAmount: number [not null, note: "Positive or negative"],
  balanceAfter: number [not null, note: "User's total XP after this event"],
  
  // Event Info
  eventCode: string [not null, enum: "trip_completion|review_received|achievement_unlock|hosting_trip|level_milestone|daily_streak|admin_award|admin_deduct"],
  description: string [maxlength: 500, nullable],
  metadata: object [nullable, note: "tripId, achievementId, etc."],
  
  // Admin
  awardedBy: ObjectId [ref: > User._id, nullable, note: "Admin who awarded/deducted"],
  isReversed: boolean [default: false, note: "Admin can mark as reversed"],
  
  // Timestamp
  createdAt: datetime [not null],
  
  indexes: {
    (userId, createdAt): [-1, note: "user XP history"],
    (userId, eventCode): [note: "XP by event type"],
    (awardedBy, createdAt): [-1, note: "admin audit trail"]
  }
}
```

**Integration:**
- Called by TripService on trip completion
- Called by ReviewService when review created
- Called by AchievementService when achievement unlocked
- User's `xp` field updated atomically with each ledger entry

---

## 14. User Badge Collection

**Status:** ✅ Fully Implemented

Tracks earned badges per user (distinct from achievements).

```typescript
{
  _id: ObjectId [pk],
  
  // User Reference
  userId: ObjectId [ref: > User._id, not null],
  
  // Badge Definition
  badgeCode: string [not null, note: "e.g., 'host_master', 'explorer_50'"],
  tier: string [not null, enum: "bronze|silver|gold|platinum"],
  name: string,
  description: string,
  iconUrl: string,
  
  // Award Info
  unlockedAt: datetime [not null],
  
  // Timestamp
  createdAt: datetime [not null],
  
  indexes: {
    (userId, badgeCode): [unique],
    (userId, tier): [note: "badges by tier"],
    (badgeCode, unlockedAt): [-1, note: "recent earners"]
  }
}
```

**Badges Types:**
- **Explorer**: 5/10/25/50 districts visited
- **Trusted Host**: 5 positive reviews, ≥4.0 rating
- **Trip Master**: 10/25/50 trips completed
- **Social Butterfly**: 50 followers
- **Safety Champion**: No incident reports
- **Achievements**: Locked when achievements completed

---

## 15. Media Upload Collection

**Status:** ✅ Fully Implemented

Stores all media uploads (photos, avatars) with Cloudinary integration and moderation.

```typescript
{
  _id: ObjectId [pk],
  
  // Uploader
  uploaderId: ObjectId [ref: > User._id, not null],
  
  // Media Type
  purpose: string [not null, enum: "avatar|trip_photo|past_experience|badge_icon"],
  tripId: ObjectId [ref: > Trip._id, nullable, note: "For trip photos"],
  
  // Status & Moderation
  status: string [not null, enum: "pending|approved|rejected|flagged_ai"],
  aiScore: number [min: 0, max: 100, default: 0, note: "AI moderation score"],
  rejectionReason: string [maxlength: 500, nullable],
  
  // Cloudinary Data
  cloudinaryPublicId: string [not null, note: "For deletion/updates"],
  cloudinaryUrl: string [not null],
  cloudinaryThumbnailUrl: string [not null, note: "300x300 optimized"],
  
  // Moderation
  reviewedBy: ObjectId [ref: > User._id, nullable, note: "Admin who reviewed"],
  reviewedAt: datetime [nullable],
  
  // Metadata
  metadata: object [nullable, note: "width, height, size, mimeType"],
  
  // Timestamps
  createdAt: datetime [not null],
  approvedAt: datetime [nullable],
  
  indexes: {
    (uploaderId, createdAt): [-1],
    (tripId, status): [note: "trip photos"],
    (status, createdAt): [-1, note: "moderation queue"],
    (purpose, status): [note: "current avatars/icons"]
  }
}
```

**Moderation Flow:**
1. User uploads → cloudinary → record with pending/flagged_ai
2. Admin reviews pending/flagged queue
3. Approve → status: approved, approvedAt set
4. Reject → status: rejected, rejectionReason set
5. Deleted media → keep record with deleted flag (soft delete)

---

## 16. Chat Group Collection

**Status:** ✅ Fully Implemented

Manages chat conversations: person-to-person, group chats, and campaign-specific group chats with auto-deletion.

```typescript
{
  _id: ObjectId [pk],
  
  // Type
  type: string [not null, enum: "person_to_person|group|campaign_group"],
  
  // Participants
  members: [ObjectId] [ref: > User._id, not null],
  createdBy: ObjectId [ref: > User._id, not null],
  
  // Group Info (groups/campaign_group only)
  name: string [maxlength: 50],
  description: string [maxlength: 200],
  groupImageUrl: string [nullable, note: "Cloudinary URL"],
  
  // Campaign Info (campaign_group only)
  campaignId: ObjectId [ref: > Campaign._id, nullable],
  tripId: ObjectId [ref: > Trip._id, nullable],
  deleteAt: datetime [nullable, note: "TTL index: auto-delete 24h after campaign ends"],
  
  // Status
  isActive: boolean [default: true],
  lastMessageAt: datetime [note: "For sorting conversations"],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (members, type): [note: "find chats for user"],
    (createdBy, createdAt): [-1],
    campaignId: [note: "chats for campaign"],
    lastMessageAt: [-1, note: "recent conversations"],
    deleteAt: [note: "TTL index: expireAfterSeconds 0"]
  }
}
```

**Features:**
- Person-to-person: Auto-created on first message between two users
- Group: Creator can add/remove members
- Campaign Group: Auto-delete 24 hours after campaign/trip ends via MongoDB TTL
- LastMessageAt updated on each message for conversation sorting

---

## 17. Chat Message Collection

**Status:** ✅ Fully Implemented

Stores all chat messages with read tracking and soft-delete support.

```typescript
{
  _id: ObjectId [pk],
  
  // References
  chatGroupId: ObjectId [ref: > ChatGroup._id, not null],
  senderId: ObjectId [ref: > User._id, not null],
  recipientId: ObjectId [ref: > User._id, nullable, note: "For person_to_person"],
  
  // Content
  messageType: string [not null, enum: "text|image|file|location"],
  content: string [required, maxlength: 5000],
  attachmentUrl: string [nullable, note: "Cloudinary URL for images/files"],
  metadata: object [nullable, note: "lat/lng for location, filename/size for files"],
  
  // Read Status
  readBy: [ObjectId] [ref: > User._id, default: [senderId]],
  
  // Deletion
  isDeleted: boolean [default: false, note: "Soft delete"],
  deletedReason: string [enum: "user|admin|auto"],
  
  // Editing
  editedAt: datetime [nullable],
  
  // Timestamps
  createdAt: datetime [not null],
  updatedAt: datetime [not null],
  
  indexes: {
    (chatGroupId, createdAt): [-1, note: "messages in chat"],
    (senderId, createdAt): [-1, note: "messages by user"],
    (recipientId, createdAt): [-1, note: "person_to_person"],
    (chatGroupId, isDeleted): [note: "active messages"],
    readBy: [note: "message read status"]
  }
}
```

**Message Operations:**
- Send: Any group member can send
- Edit: Sender can edit within time window, editedAt tracked
- Delete (Soft): Sender can delete, content replaced with "[This message was deleted]"
- Read Status: Auto-marks sender as read, others marked via API call
- Search: Full-text search within a chat by query

**Auto-Deletion:**
- Person-to-person: Manual deletion only
- Group: Manual deletion only
- Campaign Group: Deleted via TTL index 24h after campaign ends

