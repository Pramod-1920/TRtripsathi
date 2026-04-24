# Backend Scripts

## XP Rule Seed

This script upserts the default XP rules into the `extraitems` collection with `category: "xp"`. It is safe to run multiple times: existing rules are updated in-place, and missing rules are created.

### What it does

- Connects to MongoDB using `MONGODB_URI`.
- Ensures each XP rule exists with normalized values (lowercased event keys, numeric points).
- Stores the rule payload in the `value` field as a JSON string.

### Required environment

Set `MONGODB_URI` in your environment or a `.env` file (either `backend/.env` or project root `.env`).

Optional overrides for DB connection timeouts:

- `MONGODB_CONNECT_TIMEOUT_MS` (default `5000`)
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS` (default `5000`)

### Run the seed

```powershell
npm run seed:xp
```

### Output

The script prints how many rules were created vs updated:

```
XP seed finished. created=3, updated=9, total=12
```

### Default XP rules

- Difficulty Easy Completion XP (`campaign_completed`, 60 points, once per campaign, difficulty: easy)
- Difficulty Moderate Completion XP (`campaign_completed`, 90 points, once per campaign, difficulty: moderate)
- Difficulty Challenging Completion XP (`campaign_completed`, 130 points, once per campaign, difficulty: challenging)
- Difficulty Hard Completion XP (`campaign_completed`, 180 points, once per campaign, difficulty: hard)
- Difficulty Extreme Completion XP (`campaign_completed`, 240 points, once per campaign, difficulty: extreme)
- Host Campaign Completed XP (`host_campaign_completed`, 150 points, once per campaign, host only)
- Group Photo Upload XP (`group_photo_uploaded`, 25 points, once per campaign)
- Solo Traveller Photo Upload XP (`solo_photo_uploaded`, 35 points, once per campaign, solo only)
- First Solo Trek XP (`first_solo_trek`, 120 points, once per user, solo only)
- First Trek In New District XP (`first_trek_new_district`, 80 points, once per district)
- Received Five Star Rating XP (`received_five_star_rating`, 70 points, always, rating ≥ 5)
- Referral Completed Trek XP (`referral_completed_trek`, 160 points, once per referred user)

### Troubleshooting

- **Hangs or slow start:** MongoDB is likely unreachable. Verify `MONGODB_URI` and network access.
- **Duplicate key errors:** Ensure the `extraitems` collection is healthy and that `extraCode` is unique (the script already retries).
- **No updates:** Confirm the `category` is still `xp` and rule `name` strings match the defaults.
