# TRtripsathi XP SYSTEM (v2) - DESIGN DOCUMENT

## 1. SYSTEM GOAL

The XP system is designed to:

- Reward real-world exploration (hikes, treks, temples, travel)
- Stay fully dynamic and admin-controlled
- Prevent XP farming and abuse
- Support Level (1-100) and Rank (F -> SSS) systems
- Scale into future features (quests, seasons, events)

## 2. CORE XP PHILOSOPHY

```text
XP should reward:
1. Exploration (new places)
2. Effort (difficulty + distance)
3. Rarity (hidden / unique places)
NOT repetition.
```

## 3. XP ENGINE OVERVIEW

Final XP Formula:

```text
Final XP =
(Base XP OR Admin Override XP)
x Difficulty Multiplier
x Rarity Multiplier
+ Exploration Bonus
+ Social Bonus
- Repeat Penalty
```

## 4. XP SOURCES PRIORITY

```text
1. Admin Override XP (highest priority)
2. Admin Rule XP
3. System Base XP
4. Fallback XP (safe default)
```

Only one base source is used per event.

## 5. XP CATEGORIES

### A. Base Activity XP

| Difficulty | XP |
| ---------- | -- |
| Easy | 50 |
| Moderate | 100 |
| Hard | 180 |
| Extreme | 300 |

### B. Activity Multipliers

| Activity | Multiplier |
| -------- | ---------- |
| Hike | x1.2 |
| Trek | x2.0 |
| Adventure | x2.5 |
| Campaign | x1.5 |

### C. Exploration Bonuses

| Condition | XP Bonus |
| --------- | -------- |
| First visit | +150 |
| New district | +250 |
| Hidden gem | +300 |
| Rare route | +400 |

### D. Social XP

| Action | XP |
| ------ | -- |
| Campaign creation | +100 |
| Campaign hosting | +150 |
| Referral | +250 |

### E. Rarity System

| Rarity | Multiplier |
| ------ | ---------- |
| Common | x1.0 |
| Rare | x1.3 |
| Epic | x1.6 |
| Legendary | x2.0 |

## 6. ANTI-FARMING SYSTEM

Repeat Penalty (Location-based):

| Repeat | XP |
| ------ | -- |
| 1st visit | 100% |
| 2nd visit | 60% |
| 3rd visit | 30% |
| 4th visit | 10% |
| 5th+ | 0% |

Rule:

- If user visits same place/destination more than 4 times, no XP is provided.

Cooldown:

- Same location repeated within 24h: penalty applies.
- After 7 days: partial reset of penalty (design target).

## 7. XP SAFETY LIMITS

```text
Max XP per activity = 2500 XP
```

Prevents economy breaking.

## 8. ADMIN SYSTEM (SIMPLIFIED)

No manual JSON editing required in routine workflows.

Admin UI supports:

- Select activity type
- Set base XP
- Choose multipliers
- Add bonuses
- Set rarity
- Toggle repeat penalty
- Create and edit ranks
- Set level ranges per rank
- Define and reorder sub-ranks
- Set XP per level
- Edit rank requirements for hikes, treks, temples, routes, unique locations, and difficult routes
- Toggle hidden ranks on or off
- Adjust difficulty globally without redeploying code
- Save rule

XP Simulator:

- Admin can test activity, location, and difficulty
- Returns breakdown and final XP
- No database writes

## 9. DATABASE DESIGN (CLEAN VIEW)

XP Rule shape:

```ts
{
  id,
  activityType,
  baseXP,
  difficultyMultiplier,
  rarity,
  bonuses: {
    firstVisit,
    hiddenGem,
    newDistrict
  },
  repeatPenaltyEnabled,
  overrideXP,
  active
}
```

Level config shape:

```ts
{
  levelNumber,
  xpRequired,
  formula: {
    baseXP,
    multiplier,
    overrideEnabled,
    manualOverrideXP
  },
  active
}
```

Rank config shape:

```ts
{
  name,
  code,
  minLevel,
  maxLevel,
  subRanks: [
    { name, order }
  ],
  requirements: {
    hikes,
    treks,
    temples,
    routes,
    uniqueLocations,
    difficultRoutes,
    achievements
  },
  isHidden,
  unlockConditions,
  active
}
```

User XP Record shape:

```ts
{
  userId,
  currentXP,
  currentLevel,
  rank,
  subRank,
  stats: {
    hikes,
    treks,
    temples,
    routes,
    uniqueLocations,
    difficultRoutes
  },
  xpHistory: [
    {
      activity,
      xpEarned,
      locationId,
      timestamp,
      breakdown
    }
  ]
}
```

## 10. LEVEL SYSTEM (1 -> 100)

Levels are fully configurable in MongoDB and can be adjusted by admin without redeploying code.

Default formula:

```text
XP_needed = baseXP + (level × multiplier)
```

Rules:

- Each level stores its own `xpRequired`
- Admin can manually override a single level or the full formula
- Global difficulty tuning can modify the curve for all future progression checks
- XP progression never resets on rank change

Recommended level curve:

| Level Range | Progression Type |
| ----------- | ---------------- |
| 1-10 | Fast onboarding |
| 11-20 | Controlled ramp |
| 21-40 | Steady grind |
| 41-60 | High effort |
| 61-85 | Elite progression |
| 86-99 | Hidden endgame |
| 100 | Final capstone |

## 11. RANK & SUB-RANK SYSTEM

Rank is determined by level, but rank-up is locked unless both XP and activity requirements are satisfied.

| Rank Code | Rank Name | Level Range | Visibility |
| --------- | --------- | ----------- | --------- |
| E | Novice Wanderer | 1-10 | Visible |
| D | Trail Hunter | 11-20 | Visible |
| C | Ridge Slayer | 21-30 | Visible |
| B | Summit Conqueror | 31-40 | Visible |
| A | Himalayan Elite | 41-50 | Visible |
| S | Peak Sovereign | 51-60 | Visible |
| SS | Everest Legend | 61-70 | Visible |
| SSS | Nepal Hike God | 71-85 | Visible |
| ??? | Himalayan Deity | 86-99 | Hidden |
| Ultimate | Nepal Conqueror | 100 | Visible |

Each rank has 3 sub-ranks that are mapped automatically from the user’s position inside the level band:

- E: Spark, Path, Rise
- D: Track, Hunt, Stalk
- C: Edge, Strike, Slay
- B: Climb, Break, Conquer
- A: Frost, Storm, Crown
- S: Cloud, Thunder, Sovereign
- SS: Myth, Legend, Eternal
- SSS: Divine, Ascend, God
- Himalayan Deity: Awakened, Transcendent, Infinite
- Nepal Conqueror: Mythic, Eternal, Supreme

Rank-up gates:

- Minimum XP for the target level range
- Required activities for that rank
- Required exploration stats such as hikes, treks, temples, routes, unique locations, or difficult routes
- Hidden ranks remain locked until unlock conditions are met

Hidden rank behavior:

- Himalayan Deity stays hidden until the user reaches SSS and satisfies advanced achievements and special conditions
- Nepal Conqueror is the extreme endgame rank at level 100 and should feel like a final boss completion state

## 12. SYSTEM FLOW

```text
User Action
-> XP Engine
-> Rule Matching
-> Bonus Calculation
-> Penalty Check
-> Add XP
-> Check Level Progression
-> Update Level
-> Determine Rank from Level
-> Validate Rank Requirements
-> Assign Sub-Rank
-> Trigger Rank-Up Event
-> Save History
```

## 13. SYSTEM SAFETY RULES

- No XP without backend validation
- No direct XP assignment from frontend
- All XP must be logged
- Rule changes must not affect past XP
- Admin actions must be audited

## 14. ADMIN XP EDIT AND DELETE

Admin can edit and delete awarded XP entries from user history.

Endpoints:

- PATCH /user/admin/profiles/:id/xp/history/:historyId
- DELETE /user/admin/profiles/:id/xp/history/:historyId

Admin UI:

- Available in Admin user details page under XP History Manager
- File: Admin/app/users/[id]/page.tsx
- Supports inline Edit XP and Delete per history row

Behavior:

- XP total is adjusted safely
- Level/rank progression is recalculated
- Admin action is audited
- Admin reason is mandatory for both update and delete actions

Anti-farming enforcement note:

- Same place/destination after 4 completed visits awards 0 XP (5th+ visit no XP)

## 15. FUTURE EXTENSIONS

System supports:

- Seasonal XP multipliers
- Event-based XP boosts
- Quest chains
- Daily challenges
- Guild/crew XP sharing
- Leaderboards

## FINAL SUMMARY

The XP system ensures:

- Easy admin control
- Balanced progression
- Anti-farming protection
- Scalable architecture
- Game-like progression loop

```text
XP rewards exploration, not repetition.
```
