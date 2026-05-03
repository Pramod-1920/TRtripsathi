# Rank-Up Achievement System - File Structure & Implementation Map

## Complete File Listing

```
TRtripsathi/
├── backend/
│   ├── src/
│   │   └── achievement/
│   │       ├── schemas/
│   │       │   ├── achievement-definition.schema.ts (existing)
│   │       │   ├── user-achievement.schema.ts (existing)
│   │       │   ├── rank-up-achievement.schema.ts ✨ NEW
│   │       │   └── user-rank-up-achievement.schema.ts ✨ NEW
│   │       │
│   │       ├── dto/
│   │       │   ├── achievement.dto.ts (existing)
│   │       │   └── rank-up-achievement.dto.ts ✨ NEW
│   │       │
│   │       ├── achievement.controller.ts (existing)
│   │       ├── achievement.service.ts (existing)
│   │       ├── rank-up-achievement.controller.ts ✨ NEW
│   │       ├── rank-up-achievement.service.ts ✨ NEW
│   │       └── achievement.module.ts (UPDATED)
│   │
│   ├── RANK_UP_ACHIEVEMENTS.md ✨ NEW (API docs)
│   └── RANK_UP_ACHIEVEMENTS_INTEGRATION.md ✨ NEW (Integration guide)
│
├── RANK_UP_SYSTEM_COMPLETE.md ✨ NEW (Summary)
└── IMPLEMENTATION_SUMMARY.md ✨ NEW (Overview)
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RANK-UP SYSTEM FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. ADMIN CREATES ACHIEVEMENTS
   ┌──────────────────────────────────┐
   │ POST /rank-up-achievements       │
   │ {                                │
   │   targetRank: 'A',               │
   │   activityTypes: ['hike','trek'],│
   │   conditionField: 'hikes',       │
   │   conditionValue: 10             │
   │ }                                │
   └──────────────────────────────────┘
            ↓
   ┌─────────────────────────────────┐
   │ RankUpAchievementService.create()│
   └─────────────────────────────────┘
            ↓
   ┌─────────────────────────────────┐
   │ MongoDB: RankUpAchievement       │
   │ (Admin-defined requirements)     │
   └─────────────────────────────────┘

2. USER COMPLETES ACTIVITIES
   ┌──────────────────────────────────┐
   │ TripService.completeTrip()        │
   │ (activityType: 'hike')            │
   └──────────────────────────────────┘
            ↓
   ┌──────────────────────────────────┐
   │ User.stats.hikes++               │
   │ (Now: 7/10 toward rank A)         │
   └──────────────────────────────────┘

3. SYSTEM TRACKS PROGRESS
   ┌──────────────────────────────────┐
   │ RankUpAchievementService         │
   │ .updateProgress(                 │
   │   userId,                         │
   │   achievementId,                  │
   │   currentProgress: 7              │
   │ )                                │
   └──────────────────────────────────┘
            ↓
   ┌─────────────────────────────────┐
   │ MongoDB: UserRankUpAchievement   │
   │ (Individual user progress)       │
   └─────────────────────────────────┘

4. USER CHECKS RANK ELIGIBILITY
   ┌──────────────────────────────────┐
   │ GET /rank-up-achievements/        │
   │     validate/A                    │
   └──────────────────────────────────┘
            ↓
   ┌──────────────────────────────────┐
   │ RankUpAchievementService         │
   │ .validateRankUp(userId, 'A')      │
   └──────────────────────────────────┘
            ↓
   ┌──────────────────────────────────┐
   │ Response:                        │
   │ {                                │
   │   isEligible: false,             │
   │   completedAchievements: 1,      │
   │   totalRequired: 3,              │
   │   achievementStatus: [...]       │
   │ }                                │
   └──────────────────────────────────┘

5. ONCE ALL REQUIREMENTS MET
   ┌──────────────────────────────────┐
   │ User: level=41, all achievements │
   └──────────────────────────────────┘
            ↓
   ┌──────────────────────────────────┐
   │ UserService.rankUp(userId, 'A')  │
   │ (calls validateRankUp first)      │
   └──────────────────────────────────┘
            ↓
   ┌──────────────────────────────────┐
   │ User.rank = 'A'                  │
   │ User.xp += RANK_UP_BONUS         │
   │ Emit: 'user.ranked-up' event     │
   └──────────────────────────────────┘
```

## Schema Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   SCHEMA RELATIONSHIPS                        │
└─────────────────────────────────────────────────────────────┘

USER
  │
  ├─ rank: 'B'
  ├─ level: 35
  ├─ xp: 2500
  └─ stats:
       ├─ hikes: 7
       ├─ treks: 2
       └─ ...

     ↓ references ↓

USERRANKUPACHIEVEMENT (Track user progress)
  ├─ userId: ObjectId
  ├─ rankUpAchievementId: ObjectId
  ├─ progress: 7  (completed 7 hikes)
  ├─ isCompleted: false
  └─ completedAt: null

     ↓ references ↓

RANKUPACHIEVEMENT (Admin-defined requirements)
  ├─ code: 'RANK_B_TO_A_HIKE_10'
  ├─ name: 'Hike Pioneer'
  ├─ targetRank: 'A'
  ├─ activityTypes: ['hike']
  ├─ conditionField: 'hikes'
  ├─ conditionValue: 10
  ├─ conditionOperator: 'gte'
  └─ minLevel: 31
```

## Service Method Map

```
RankUpAchievementService
│
├── ADMIN OPERATIONS
│   ├── create(dto, adminId): Promise<Achievement>
│   ├── update(id, dto): Promise<Achievement>
│   └── delete(id): Promise<void>
│
├── RETRIEVAL OPERATIONS
│   ├── findAll(filters?): Promise<Achievement[]>
│   ├── findById(id): Promise<Achievement>
│   ├── findByCode(code): Promise<Achievement>
│   ├── findByRank(rank): Promise<Achievement[]>
│   └── findByActivityType(type): Promise<Achievement[]>
│
├── USER PROGRESS OPERATIONS
│   ├── getUserAchievementProgress(userId, achievementId): Promise<UserProgress>
│   ├── updateProgress(userId, achievementId, value): Promise<UserProgress>
│   │   └─ Auto-detects completion
│   │   └─ Awards XP
│   │
│   ├── validateRankUp(userId, targetRank): Promise<Validation>
│   │   └─ Checks ALL requirements
│   │   └─ Returns detailed status
│   │
│   └── getUserRankUpProgress(userId): Promise<Validation[]>
│       └─ Gets progress for all ranks (E-SSS)
│
└── HELPER OPERATIONS
    └── checkCondition(progress, value, operator): boolean
```

## API Endpoint Map

```
/rank-up-achievements
│
├── POST / (Admin only)
│   └─ Create new achievement
│
├── GET /
│   └─ List all achievements
│   │   └─ Filters: targetRank, activityType, isActive
│
├── GET /rank/:targetRank
│   └─ Get achievements for specific rank
│   │   └─ Example: GET /rank-up-achievements/rank/A
│
├── GET /activity/:activityType
│   └─ Get achievements for activity
│   │   └─ Example: GET /rank-up-achievements/activity/trek
│
├── GET /code/:code
│   └─ Get achievement by code
│   │   └─ Example: GET /rank-up-achievements/code/RANK_B_TO_A_HIKE_10
│
├── GET /:id
│   └─ Get achievement by ID
│
├── PATCH /:id (Admin only)
│   └─ Update achievement
│
├── DELETE /:id (Admin only)
│   └─ Delete achievement
│
├── GET /validate/:targetRank (Current user)
│   └─ Check rank-up eligibility
│   │   └─ Example: GET /rank-up-achievements/validate/A
│   │   └─ Returns detailed status
│
└── GET /user/progress (Current user)
    └─ Get progress for all ranks
        └─ Returns array of validations
```

## Implementation Checklist

```
✅ Schema Design
   ├─ RankUpAchievement schema
   └─ UserRankUpAchievement schema

✅ Database Indexes
   ├─ targetRank, activityTypes, isActive
   └─ userId, achievementId, completion status

✅ Service Layer
   ├─ Achievement CRUD
   ├─ Progress tracking
   ├─ Completion detection
   └─ Rank validation

✅ API Controller
   ├─ Admin endpoints (POST, PATCH, DELETE)
   ├─ User endpoints (GET, GET /validate, GET /progress)
   └─ Proper auth guards & role checks

✅ DTOs & Validation
   ├─ Enums (RankCode, ActivityType, etc.)
   ├─ Request/Response DTOs
   └─ Validation decorators

✅ Module Integration
   ├─ Schema registration
   ├─ Service providers
   └─ Controller registration

✅ Documentation
   ├─ API documentation
   ├─ Integration guide
   └─ Usage examples

⏳ Next: Testing, Migration, Integration
```

## Key Design Decisions

```
┌─────────────────────────────────┐
│ WHY SEPARATE SCHEMA?            │
├─────────────────────────────────┤
│ ✅ Clear separation of concerns │
│ ✅ Dedicated rank-up logic      │
│ ✅ Easier queries               │
│ ✅ No complexity in general ach │
│ ✅ Better maintainability       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ WHY ACTIVITY ARRAY?             │
├─────────────────────────────────┤
│ ✅ Multiple activities support   │
│ ✅ New activities auto-included │
│ ✅ Flexible combinations         │
│ ✅ Future-proof design           │
│ ✅ No code changes needed        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ WHY VALIDATION RESPONSE?        │
├─────────────────────────────────┤
│ ✅ User sees all requirements   │
│ ✅ Clear progress tracking      │
│ ✅ Detailed status feedback     │
│ ✅ UI-friendly structure        │
│ ✅ Motivating for users         │
└─────────────────────────────────┘
```

## Getting Started

1. **Run migrations** to create collections
   - RankUpAchievement collection
   - UserRankUpAchievement collection

2. **Test API endpoints**
   - Create test achievements
   - Simulate user progress
   - Validate rank-up logic

3. **Integrate with UserService**
   - Call updateProgress() on activity completion
   - Call validateRankUp() before rank change

4. **Build admin UI**
   - Achievement management
   - Progress visualization

5. **Build user UI**
   - Rank-up requirements display
   - Progress bars
   - Notifications

---

✨ **Complete Implementation Ready!**
