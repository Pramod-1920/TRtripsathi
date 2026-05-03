# Rank-Up Achievement System - Integration Guide

## Quick Start Examples

### 1. Integrating with Trip/Campaign Completion

When a user completes a trip, update their rank-up achievement progress:

```typescript
// In trip.service.ts or campaign.service.ts

import { RankUpAchievementService } from '../achievement/rank-up-achievement.service';

@Injectable()
export class TripService {
  constructor(
    private rankUpAchievementService: RankUpAchievementService,
    // ... other dependencies
  ) {}

  async completeTrip(tripId: string, userId: string): Promise<void> {
    const trip = await this.tripModel.findById(tripId);
    
    // ... trip completion logic ...
    
    // Update rank-up achievements based on trip activity type
    const achievements = await this.rankUpAchievementService.findByActivityType(
      trip.activityType // e.g., 'hike', 'trek'
    );

    for (const achievement of achievements) {
      // Fetch user's current stat (e.g., total hikes completed)
      const user = await this.userModel.findById(userId);
      const currentCount = user.stats[achievement.conditionField]; // e.g., user.stats.hikes
      
      // Update progress
      await this.rankUpAchievementService.updateProgress(
        new Types.ObjectId(userId),
        new Types.ObjectId(achievement.id),
        currentCount
      );
    }
  }
}
```

### 2. Checking Rank-Up Eligibility Before Rank Change

When a user levels up, check if they can rank up:

```typescript
// In user.service.ts

async updateUserLevel(userId: string, newLevel: number): Promise<void> {
  const user = await this.userModel.findById(userId);
  user.level = newLevel;
  
  // Determine new rank based on level
  const newRank = this.calculateRankFromLevel(newLevel);
  
  // Validate rank-up achievements
  const validation = await this.rankUpAchievementService.validateRankUp(
    new Types.ObjectId(userId),
    newRank as RankCode
  );
  
  if (validation.isEligible) {
    // User can rank up!
    user.rank = newRank;
    
    // Award rank-up bonus XP
    user.xp += 1000;
    
    // Emit rank-up event
    this.eventEmitter.emit('user.ranked-up', {
      userId,
      newRank,
      achievements: validation.achievementStatus
    });
  } else {
    // User needs to complete more achievements
    console.log(`User ${userId} needs to complete:`, 
      validation.achievementStatus
        .filter(a => !a.isCompleted)
        .map(a => `${a.name} (${a.progress}/${a.required})`)
    );
  }
  
  await user.save();
}

private calculateRankFromLevel(level: number): string {
  if (level <= 10) return 'E';
  if (level <= 20) return 'D';
  if (level <= 30) return 'C';
  if (level <= 40) return 'B';
  if (level <= 50) return 'A';
  if (level <= 60) return 'S';
  if (level <= 70) return 'SS';
  if (level <= 85) return 'SSS';
  return 'ULTIMATE';
}
```

### 3. Initializing Rank-Up Achievements for New User

When a user signs up, initialize their rank-up achievement progress:

```typescript
// In auth.service.ts or user.service.ts

async initializeNewUser(userId: string): Promise<void> {
  // Get all rank-up achievements
  const allAchievements = await this.rankUpAchievementService.findAll({
    isActive: true
  });

  // Initialize each achievement with 0 progress
  for (const achievement of allAchievements) {
    await this.rankUpAchievementService.getUserAchievementProgress(
      new Types.ObjectId(userId),
      new Types.ObjectId(achievement.id)
    );
  }
}
```

### 4. Getting Rank-Up Progress for User Profile

When displaying user profile, show rank-up progress:

```typescript
// In user.controller.ts

@Get(':userId/rank-up-progress')
@UseGuards(JwtAuthGuard)
async getRankUpProgress(
  @Param('userId') userId: string,
): Promise<RankUpValidationResponseDto[]> {
  return this.rankUpAchievementService.getUserRankUpProgress(
    new Types.ObjectId(userId)
  );
}

// Usage in frontend:
// GET /users/123/rank-up-progress
// Returns array of achievements for each rank (E through SSS)
```

Response example:
```json
[
  {
    "targetRank": "E",
    "isEligible": true,
    "completedAchievements": 2,
    "totalRequiredAchievements": 2,
    "achievementStatus": [
      {
        "code": "RANK_START_EXPLORE",
        "name": "First Explorer",
        "isCompleted": true,
        "progress": 1,
        "required": 1
      }
    ]
  },
  {
    "targetRank": "D",
    "isEligible": false,
    "completedAchievements": 1,
    "totalRequiredAchievements": 3,
    "achievementStatus": [
      {
        "code": "RANK_D_HIKE_5",
        "name": "Hike Enthusiast",
        "isCompleted": false,
        "progress": 3,
        "required": 5
      },
      ...
    ]
  }
]
```

### 5. Admin: Creating Rank-Up Requirements for New Activity

When adding a new activity type (e.g., "climbing"), admin can create achievements without code changes:

```bash
# Add new activity type to Trip schema enum
# In trip.schema.ts, add 'climbing' to activityType enum

# Then, admin creates rank-up achievements via API

POST /rank-up-achievements
{
  "code": "RANK_B_TO_A_CLIMBING_10",
  "name": "Climbing Pioneer",
  "description": "Complete 10 climbing activities to rank up from B to A",
  "targetRank": "A",
  "activityTypes": ["climbing"],
  "conditionType": "count",
  "conditionField": "climbs",
  "conditionOperator": "gte",
  "conditionValue": 10,
  "minLevel": 31,
  "xpReward": 500,
  "isActive": true
}

# No code changes needed!
```

## Database Queries

### Get all achievements for a rank
```typescript
const achievements = await rankUpAchievementService.findByRank('A');
```

### Get user progress on specific achievement
```typescript
const progress = await rankUpAchievementService.getUserAchievementProgress(
  userId,
  achievementId
);
// Returns: { progress: 7, isCompleted: false, timesCompleted: 0 }
```

### Get achievements linked to activity
```typescript
const achievements = await rankUpAchievementService.findByActivityType('trek');
// Returns all achievements that require trek activity
```

### Check rank eligibility
```typescript
const validation = await rankUpAchievementService.validateRankUp(userId, 'S');
// Returns detailed status of all S-rank requirements
```

## Event Hooks

Consider emitting events for external systems:

```typescript
// In rank-up-achievement.service.ts

private eventEmitter: EventEmitter2;

async updateProgress(...) {
  // ... update logic ...
  
  if (isNowCompleted && !wasCompleted) {
    // Emit event when achievement is completed
    this.eventEmitter.emit('rank-up-achievement.completed', {
      userId,
      achievementCode: achievement.code,
      achievementName: achievement.name,
      targetRank: achievement.targetRank,
      xpReward: achievement.xpReward
    });
  }
}
```

Listen to events:

```typescript
// In any service
@OnEvent('rank-up-achievement.completed')
async onAchievementCompleted(payload: any) {
  // Trigger notifications
  // Update leaderboards
  // Award badges
  // etc.
}
```

## Testing Examples

### Unit Test: Check Rank Eligibility
```typescript
it('should mark user as eligible for rank-up', async () => {
  // Create rank-up achievements for rank A
  const achievement1 = await rankUpAchievementService.create({
    code: 'TEST_HIKE_5',
    name: 'Test Hike',
    targetRank: 'A',
    activityTypes: ['hike'],
    conditionType: 'count',
    conditionField: 'hikes',
    conditionValue: 5,
    minLevel: 31,
  }, adminId);

  // Initialize user progress
  await rankUpAchievementService.getUserAchievementProgress(userId, achievement1.id);

  // Update progress to completion
  await rankUpAchievementService.updateProgress(userId, achievement1.id, 5);

  // Validate
  const validation = await rankUpAchievementService.validateRankUp(userId, 'A');
  expect(validation.isEligible).toBe(true);
  expect(validation.completedAchievements).toBe(1);
});
```

### Integration Test: Complete Trip → Update Achievement
```typescript
it('should update rank-up achievement on trip completion', async () => {
  // Create trip
  const trip = await tripService.create({
    activityType: 'hike',
    // ... other fields
  });

  // Create rank-up achievement
  const achievement = await rankUpAchievementService.create({
    code: 'RANK_B_TO_A_HIKE_10',
    targetRank: 'A',
    activityTypes: ['hike'],
    conditionType: 'count',
    conditionField: 'hikes',
    conditionValue: 10,
    minLevel: 31,
  }, adminId);

  // Complete trip
  await tripService.completeTrip(trip.id, userId);

  // Check achievement progress
  const progress = await rankUpAchievementService.getUserAchievementProgress(
    userId,
    achievement.id
  );
  expect(progress.progress).toBeGreaterThan(0);
});
```

## Migration from General Achievements (if needed)

If you want to convert existing general achievements to rank-up achievements:

```typescript
// Script to migrate achievements

async function migrateAchievementsToRankUp() {
  const achievements = await db.collection('achievementdefinitions').find({
    category: 'exploration'
  }).toArray();

  for (const ach of achievements) {
    // Create rank-up version
    await rankUpAchievementService.create({
      code: `RANK_UP_${ach.code}`,
      name: ach.name,
      description: ach.description,
      targetRank: 'B', // Adjust as needed
      activityTypes: extractActivityTypes(ach), // Helper function
      conditionType: ach.conditionType,
      conditionField: ach.conditionField,
      conditionValue: ach.conditionValue,
      minLevel: 31,
      isActive: ach.isActive,
    }, adminId);
  }
}
```

## Troubleshooting

### Achievement not progressing
- Check if `conditionField` matches actual user stat field
- Verify `conditionOperator` is correct (gte vs gt, etc.)
- Ensure activity type matches between trip and achievement

### User can't rank up despite completing achievements
- Verify user's `level` meets `minLevel` requirement
- Check if achievements are `isActive: true`
- Validate all required achievements are completed (not just some)

### Adding new activity not working
- Ensure activity type is added to Trip schema enum
- Check achievement definition uses correct activity type string
- Verify achievement is `isActive: true`
