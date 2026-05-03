# Rank-Up Achievement System Documentation

## Overview

The Rank-Up Achievement System is a dedicated module for managing achievements that are required for users to rank up in the TRtripsathi app. Unlike general achievements, rank-up achievements are specifically tied to rank progression and can be linked to specific activities.

## Architecture

### Schemas

#### 1. RankUpAchievement (Admin-Defined)
Defines what achievements are required to rank up to a specific rank.

```typescript
{
  id,
  code: string,                           // Unique identifier (e.g., 'RANK_B_TO_A_HIKE_MASTER')
  name: string,                           // Display name (e.g., 'Hike Master')
  description: string,                    // What user needs to do
  
  // Rank Progression
  targetRank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS',  // Which rank to unlock
  
  // Activity Linking (KEY FEATURE)
  activityTypes: ['hike', 'trek', 'heritage', 'adventure', ...], // Related activities
  
  // Condition Logic
  conditionType: 'count' | 'value' | 'event',
  conditionField: string,                 // e.g., 'hikes', 'xp', 'level'
  conditionOperator: 'gte' | 'eq' | 'lte' | 'gt' | 'lt',
  conditionValue: number,                 // e.g., 5 (complete 5 hikes)
  
  // Optional Filtering
  filterField?: string,                   // e.g., 'difficulty'
  filterValue?: string,                   // e.g., 'expert'
  
  // Minimum Requirements
  minLevel: number,                       // Minimum level needed (e.g., 31 for rank B)
  minXp?: number,                         // Optional XP requirement
  
  // Rewards
  xpReward: number,                       // XP earned on completion
  badgeCode?: string,                     // Badge identifier
  
  // Lifecycle
  isActive: boolean,                      // Is this achievement active?
  isRepeatable: boolean,                  // Can be unlocked multiple times?
  maxCompletions?: number,                // Max unlock times (null = unlimited)
  
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. UserRankUpAchievement (User Progress)
Tracks individual user progress on rank-up achievements.

```typescript
{
  id,
  userId: ObjectId,
  rankUpAchievementId: ObjectId,          // Reference to RankUpAchievement
  
  // Progress
  progress: number,                       // Current value (e.g., completed 3 of 5 hikes)
  isCompleted: boolean,                   // Achievement completed?
  completedAt?: Date,                     // When completed
  
  // Repeatable Tracking
  timesCompleted: number,                 // How many times unlocked
  lastCompletedAt?: Date,                 // Last completion date
  
  // Rank Context
  rankedUpTo: 'A' | 'S' | ...             // Which rank was achieved
  
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Admin Endpoints

#### Create Rank-Up Achievement
```
POST /rank-up-achievements
Authorization: Bearer <token>
Role: Admin

Body:
{
  "code": "RANK_B_TO_A_HIKE_10",
  "name": "Hike Pioneer",
  "description": "Complete 10 hiking activities to rank up from B to A",
  "targetRank": "A",
  "activityTypes": ["hike"],
  "conditionType": "count",
  "conditionField": "hikes",
  "conditionOperator": "gte",
  "conditionValue": 10,
  "minLevel": 31,
  "xpReward": 500,
  "isActive": true
}
```

#### Update Rank-Up Achievement
```
PATCH /rank-up-achievements/:id
Authorization: Bearer <token>
Role: Admin
```

#### Delete Rank-Up Achievement
```
DELETE /rank-up-achievements/:id
Authorization: Bearer <token>
Role: Admin
```

### User Endpoints

#### Get All Rank-Up Achievements
```
GET /rank-up-achievements
Authorization: Bearer <token>

Query Parameters:
  - targetRank: 'A', 'B', 'S', etc.
  - activityType: 'hike', 'trek', etc.
  - isActive: true/false
```

#### Get Achievements for Specific Rank
```
GET /rank-up-achievements/rank/:targetRank
Authorization: Bearer <token>

Example: GET /rank-up-achievements/rank/A
```

#### Get Achievements by Activity Type
```
GET /rank-up-achievements/activity/:activityType
Authorization: Bearer <token>

Example: GET /rank-up-achievements/activity/trek
```

#### Validate Rank-Up Eligibility
```
GET /rank-up-achievements/validate/:targetRank
Authorization: Bearer <token>

Response:
{
  "targetRank": "A",
  "isEligible": true,
  "completedAchievements": 3,
  "totalRequiredAchievements": 3,
  "achievementStatus": [
    {
      "code": "RANK_B_TO_A_HIKE_10",
      "name": "Hike Pioneer",
      "isCompleted": true,
      "progress": 10,
      "required": 10
    },
    ...
  ],
  "reason": "All achievements completed"
}
```

#### Get All Rank-Up Progress
```
GET /rank-up-achievements/user/progress
Authorization: Bearer <token>

Response: Array of RankUpValidationResponseDto for all ranks (E-SSS)
```

## Usage Examples

### Example 1: Create Rank-Up Achievement for B→A

Requirements for ranking up from B (level 31-40) to A (level 41-50):
- Complete 10 hikes
- Complete 5 treks
- Reach level 41

```json
{
  "code": "RANK_B_TO_A_HIKE_10",
  "name": "Hike Pioneer",
  "description": "Complete 10 hiking activities",
  "targetRank": "A",
  "activityTypes": ["hike"],
  "conditionType": "count",
  "conditionField": "hikes",
  "conditionOperator": "gte",
  "conditionValue": 10,
  "minLevel": 31,
  "xpReward": 500,
  "badgeCode": "HIKE_PIONEER"
}
```

```json
{
  "code": "RANK_B_TO_A_TREK_5",
  "name": "Trek Enthusiast",
  "description": "Complete 5 trekking activities",
  "targetRank": "A",
  "activityTypes": ["trek"],
  "conditionType": "count",
  "conditionField": "treks",
  "conditionOperator": "gte",
  "conditionValue": 5,
  "minLevel": 31,
  "xpReward": 400
}
```

### Example 2: Adding Activity Type Support

When a new activity type is added (e.g., "climbing"), existing rank-up achievements automatically support it:

```json
{
  "code": "RANK_A_TO_S_CLIMBING_15",
  "name": "Climbing Master",
  "description": "Master climbing with 15 climbing activities",
  "targetRank": "S",
  "activityTypes": ["climbing"],  // NEW activity type
  "conditionType": "count",
  "conditionField": "climbs",
  "conditionOperator": "gte",
  "conditionValue": 15,
  "minLevel": 41,
  "xpReward": 600
}
```

No code changes needed—admin can create this via the API.

### Example 3: Difficulty-Based Achievement

```json
{
  "code": "RANK_S_TO_SS_EXPERT_TREK",
  "name": "Expert Trekker",
  "description": "Complete 3 expert-level trekking expeditions",
  "targetRank": "SS",
  "activityTypes": ["trek"],
  "conditionType": "count",
  "conditionField": "treks",
  "conditionOperator": "gte",
  "conditionValue": 3,
  "filterField": "difficulty",
  "filterValue": "expert",
  "minLevel": 51,
  "xpReward": 800
}
```

## Integration Points

### 1. User Service
After activities are completed, call RankUpAchievementService to:
- Update progress
- Check rank-up eligibility
- Award XP bonuses

### 2. Trip/Campaign Completion
When a trip/campaign completes:
```typescript
// Update achievement progress based on trip activityType
await rankUpAchievementService.updateProgress(userId, achievementId, newProgress);

// Check if user can now rank up
const validation = await rankUpAchievementService.validateRankUp(userId, 'A');
if (validation.isEligible) {
  // Trigger rank-up event
}
```

### 3. Activity Management
When adding new activities:
1. Add to Trip.schema.ts `activityType` enum
2. Create corresponding rank-up achievements
3. No service code changes needed

## Key Features

✅ **Activity-Linked Achievements**: Each achievement explicitly links to activity types
✅ **Dynamic Activity Support**: New activities can be added without code changes
✅ **Flexible Conditions**: Support count, value, and event-based conditions
✅ **Filtering**: Optional difficulty/category filters for achievements
✅ **Repeatable Achievements**: Support for repeated unlocks with tracking
✅ **Progress Tracking**: Real-time progress monitoring per user
✅ **Rank Validation**: Check rank-up eligibility before promotion
✅ **XP Rewards**: Award XP on achievement completion

## Future Extensions

- Seasonal rank-up challenges
- Activity-specific seasonal variations
- Achievement cascading (complete X to unlock Y)
- Leaderboard tracking
- Badge system integration
- Milestone notifications
