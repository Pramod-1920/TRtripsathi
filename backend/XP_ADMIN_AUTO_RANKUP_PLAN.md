# Admin XP Management & Auto Rank-Up System Implementation

## Requirements

1. **Admin XP Interface Changes**
   - Change from "Edit XP" to "Add XP" 
   - Cap additions at 500 XP maximum per action
   - Show current user XP before adding
   - Require reason for addition (existing)

2. **Auto Rank-Up System**
   - When user gains XP and reaches next rank level threshold
   - Check if all rank-up achievements for that rank are completed
   - If both conditions met, automatically promote user to new rank

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Create New DTO for Adding XP (not editing)
File: `backend/src/user/dto/admin-add-xp.dto.ts`

```typescript
export class AdminAddXpDto {
  @IsNumber()
  @Min(1)
  @Max(500)
  xpToAdd: number; // Must be between 1-500

  @IsString()
  @MinLength(5)
  reason: string; // Why admin is adding XP
}
```

#### 1.2 Update User Service with Two New Methods

**Method 1: `adminAddXpToUser()` - Add XP (not edit)**
- Takes profileId, xpToAdd (1-500), reason
- Adds XP to user.xp (current rank XP)
- Also adds to user.totalXp (lifetime XP)
- Creates xpHistory entry with type 'admin.add_xp'
- Returns: { newXp, newLevel, newRank, autoRankedUp }

**Method 2: `validateAndApplyAutoRankUp()` - Check rank eligibility**
- Called after XP addition
- Checks user.xp against nextLevelXp threshold
- Gets next rank based on new level
- Calls RankUpAchievementService.validateRankUp()
- If eligible and achievements complete:
  - Promote to new rank
  - Update level if needed
  - Reset user.xp to 0 (for next rank)
  - Emit 'user.ranked-up' event
  - Return { rankedUp: true, newRank }

#### 1.3 Create New Controller Endpoint
File: `backend/src/user/user.controller.ts`

```typescript
@Post('admin/profiles/:id/xp/add')
@UseGuards(RolesGuard)
@Roles(Role.Admin)
@ApiOperation({ summary: 'Admin: add XP to user (capped at 500 per action)' })
async adminAddXpToProfile(
  @Param('id') profileId: string,
  @Body() body: AdminAddXpDto,
  @GetCurrentUser('userId') adminId: string,
) {
  // calls userService.adminAddXpToUser()
  // logs audit event
  // returns result with auto-rank-up status
}
```

#### 1.4 Integrate with RankUpAchievementService
- Inject RankUpAchievementService into UserService
- After XP addition, call validateAndApplyAutoRankUp()
- This internally calls rankUpAchievementService.validateRankUp()

### Phase 2: Frontend Changes

#### 2.1 Update Admin User Profile Page
File: `Admin/app/users/[id]/page.tsx`

**Changes:**
1. Replace "Edit XP" button with "Add XP" button
2. Create new modal for adding XP instead of editing
3. Show current XP in header: "Current Rank XP: {formData.xp} / {requiredXp}"
4. Input field: max 500, min 1
5. Reason field (existing)
6. On success: show "Added X XP, Current XP: Y/Z" message
7. Show auto-rank-up notification if applicable

**UI Mockup:**

```
┌─────────────────────────────────┐
│   Add XP to User                │
├─────────────────────────────────┤
│                                 │
│ Current Rank XP: 850 / 1000    │
│ (Level: 35, Rank: B)            │
│                                 │
│ XP to Add: [___] (max 500)      │
│ Reason: [________________]      │
│                                 │
│  [ Add XP ]  [ Cancel ]        │
│                                 │
│ Note: When you reach the next  │
│ rank's XP threshold AND complete│
│ all rank-up achievements, the  │
│ user will automatically rank up.│
│                                 │
└─────────────────────────────────┘
```

#### 2.2 Disable "Edit XP" and "Delete" on History
- Remove Edit/Delete buttons from XP history table
- Add note: "XP history is immutable. Use 'Add XP' button to modify"
- Keep history view-only for transparency

#### 2.3 Show Auto-Rank-Up Alert
When auto-rank-up happens, show:
```
✅ XP Added Successfully!
   User ranked up: B → A
   Requirements completed:
   ✓ Hike Pioneer (10/10)
   ✓ Trek Enthusiast (5/5)
   Auto-promotion applied.
```

### Phase 3: Data Model Updates

#### 3.1 XP History Entry Type
Add new type for admin XP addition:
```typescript
{
  _id: ObjectId,
  eventKey: 'admin.add_xp',
  points: 250,
  reason: 'Player achieved milestone',
  createdBy: adminId,
  awardedAt: Date,
  context: {
    previousXp: 600,
    newXp: 850,
    autoRankedUp: false
  }
}
```

### Phase 4: Logic Implementation

#### 4.1 Level & XP Thresholds
```typescript
// Example: Level 35 → 36 needs 1000 XP in current rank
// If user is at 850 XP and we add 200, new XP = 1050
// Since 1050 > 1000, user levels up to 36
// Check rank of level 36: still "B"
// Check next rank "A" at level 41
// Update: level=36, xp reset based on next threshold

// If adding would reach level 41+:
// Check all B→A rank-up achievements
// If all met: promote to "A", reset level to 41, reset xp to 0
// If not all met: level=41 but rank stays "B" (blocked)
```

#### 4.2 Auto Rank-Up Logic Flow

```
Admin adds XP
    ↓
Update user.xp and user.totalXp
    ↓
Calculate new level based on total XP
    ↓
level < minLevel of next rank?
    ├─ YES: Rank stays same, done
    └─ NO: Check rank-up achievements
           ↓
      All rank-up achievements met?
           ├─ YES: Promote user to new rank ✅
           │       Reset xp to 0
           │       Update level
           │       Emit event
           └─ NO: User level up but rank blocked
                  Show message: "Complete X more achievements"
```

## API Endpoints Summary

**Old (Deprecated):**
- `PATCH /user/admin/profiles/:id/xp/history/:historyId` - Edit XP entry
- `DELETE /user/admin/profiles/:id/xp/history/:historyId` - Delete XP entry

**New:**
- `POST /user/admin/profiles/:id/xp/add` - Add XP to user (1-500 max)
  - Input: { xpToAdd: number, reason: string }
  - Output: { newXp, newLevel, newRank, autoRankedUp: boolean, message }

## Database Queries

```typescript
// Find next rank based on level
const nextRank = RANK_TIERS.find(tier => 
  newLevel >= tier.minLevel && newLevel <= tier.maxLevel
);

// Get rank-up achievements for that rank
const achievements = await rankUpAchievementService.findByRank(nextRank);

// Validate user completed all
const validation = await rankUpAchievementService.validateRankUp(userId, nextRank);

// Auto-promote if eligible
if (validation.isEligible) {
  user.rank = nextRank;
  user.level = newLevel;
  user.xp = 0; // Reset for next rank
  await user.save();
  emit('user.ranked-up', { userId, newRank, reason: 'auto' });
}
```

## Files to Create/Modify

### Create:
- `backend/src/user/dto/admin-add-xp.dto.ts` (NEW)
- Plan updated in documentation

### Modify:
- `backend/src/user/user.service.ts` - Add 2 new methods
- `backend/src/user/user.controller.ts` - Add 1 new endpoint
- `Admin/app/users/[id]/page.tsx` - UI changes
- `Admin/lib/api.ts` - Add new API call if needed

## Error Handling

1. **Invalid XP amount**: "XP must be between 1 and 500"
2. **Missing reason**: "Reason is required"
3. **User not found**: "User profile not found"
4. **Invalid amount format**: "XP must be a valid number"

## Validation Rules

1. XP to add: 1 ≤ xpToAdd ≤ 500 ✅
2. Reason: min 5 characters ✅
3. User exists ✅
4. Admin has authorization ✅
5. Auto-rank logic only triggers if achievements met ✅

## Future Enhancements

1. Batch XP operations (multiple users)
2. XP decay/reduction (if needed)
3. Scheduled auto-rank-ups for batch processing
4. XP bonus multipliers for special events
5. Seasonal rank-up requirements variations
