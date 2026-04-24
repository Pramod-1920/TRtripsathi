import fs from 'fs';
import path from 'path';
import mongoose, { Model, Schema } from 'mongoose';

type XpRuleRepeatMode =
  | 'always'
  | 'once_per_user'
  | 'once_per_campaign'
  | 'once_per_district'
  | 'once_per_difficulty'
  | 'once_per_referred_user';

type XpRuleValue = {
  eventKey: string;
  points: number;
  repeat: XpRuleRepeatMode;
  conditions?: {
    difficulty?: string;
    district?: string;
    ratingGte?: number;
    solo?: boolean;
    hostOnly?: boolean;
  };
};

type ExtraDocument = {
  _id?: unknown;
  extraCode: string;
  category: string;
  name: string;
  description?: string | null;
  value?: string | null;
  enabled: boolean;
};

type RuleSeed = {
  name: string;
  description: string;
  value: XpRuleValue;
};

const extraSchema = new Schema<ExtraDocument>(
  {
    extraCode: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    value: { type: String, default: null },
    enabled: { type: Boolean, default: true },
  },
  {
    collection: 'extraitems',
    timestamps: true,
  },
);

const ExtraModel: Model<ExtraDocument> =
  mongoose.models.ExtraItem || mongoose.model<ExtraDocument>('ExtraItem', extraSchema);

function readMongoUri() {
  const direct = process.env.MONGODB_URI?.trim();

  if (direct) {
    return direct;
  }

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key === 'MONGODB_URI' && value) {
        return value;
      }
    }
  }

  throw new Error('MONGODB_URI is not set in environment or .env');
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function defaultRules(): RuleSeed[] {
  return [
    {
      name: 'Difficulty Easy Completion XP',
      description: 'XP for completing easy campaigns as participant',
      value: {
        eventKey: 'campaign_completed',
        points: 60,
        repeat: 'once_per_campaign',
        conditions: { difficulty: 'easy' },
      },
    },
    {
      name: 'Difficulty Moderate Completion XP',
      description: 'XP for completing moderate campaigns as participant',
      value: {
        eventKey: 'campaign_completed',
        points: 90,
        repeat: 'once_per_campaign',
        conditions: { difficulty: 'moderate' },
      },
    },
    {
      name: 'Difficulty Challenging Completion XP',
      description: 'XP for completing challenging campaigns as participant',
      value: {
        eventKey: 'campaign_completed',
        points: 130,
        repeat: 'once_per_campaign',
        conditions: { difficulty: 'challenging' },
      },
    },
    {
      name: 'Difficulty Hard Completion XP',
      description: 'XP for completing hard campaigns as participant',
      value: {
        eventKey: 'campaign_completed',
        points: 180,
        repeat: 'once_per_campaign',
        conditions: { difficulty: 'hard' },
      },
    },
    {
      name: 'Difficulty Extreme Completion XP',
      description: 'XP for completing extreme campaigns as participant',
      value: {
        eventKey: 'campaign_completed',
        points: 240,
        repeat: 'once_per_campaign',
        conditions: { difficulty: 'extreme' },
      },
    },
    {
      name: 'Host Campaign Completed XP',
      description: 'XP for successfully hosting and completing a campaign',
      value: {
        eventKey: 'host_campaign_completed',
        points: 150,
        repeat: 'once_per_campaign',
        conditions: { hostOnly: true },
      },
    },
    {
      name: 'Group Photo Upload XP',
      description: 'XP for uploading a group campaign photo',
      value: {
        eventKey: 'group_photo_uploaded',
        points: 25,
        repeat: 'once_per_campaign',
      },
    },
    {
      name: 'Solo Traveller Photo Upload XP',
      description: 'XP for uploading solo trek photo',
      value: {
        eventKey: 'solo_photo_uploaded',
        points: 35,
        repeat: 'once_per_campaign',
        conditions: { solo: true },
      },
    },
    {
      name: 'First Solo Trek XP',
      description: 'Bonus XP for first solo trek completion',
      value: {
        eventKey: 'first_solo_trek',
        points: 120,
        repeat: 'once_per_user',
        conditions: { solo: true },
      },
    },
    {
      name: 'First Trek In New District XP',
      description: 'XP bonus when user completes first trek in a district',
      value: {
        eventKey: 'first_trek_new_district',
        points: 80,
        repeat: 'once_per_district',
      },
    },
    {
      name: 'Received Five Star Rating XP',
      description: 'XP bonus for receiving 5-star review from group members',
      value: {
        eventKey: 'received_five_star_rating',
        points: 70,
        repeat: 'always',
        conditions: { ratingGte: 5 },
      },
    },
    {
      name: 'Referral Completed Trek XP',
      description: 'XP bonus when referred user completes a trek',
      value: {
        eventKey: 'referral_completed_trek',
        points: 160,
        repeat: 'once_per_referred_user',
      },
    },
  ];
}

async function generateExtraCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let suffix = '';

    for (let index = 0; index < 6; index += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    const extraCode = `EXT-${suffix}`;
    const existing = await ExtraModel.exists({ extraCode });

    if (!existing) {
      return extraCode;
    }
  }

  throw new Error('Unable to generate unique extraCode for XP rule');
}

async function upsertRule(rule: RuleSeed) {
  const existing = await ExtraModel.findOne({
    category: 'xp',
    name: rule.name,
  });

  const normalizedValue: XpRuleValue = {
    eventKey: normalizeKey(rule.value.eventKey),
    points: Math.floor(rule.value.points),
    repeat: rule.value.repeat,
    ...(rule.value.conditions
      ? {
          conditions: {
            ...(rule.value.conditions.difficulty
              ? { difficulty: normalizeKey(rule.value.conditions.difficulty) }
              : {}),
            ...(rule.value.conditions.district
              ? { district: normalizeKey(rule.value.conditions.district) }
              : {}),
            ...(rule.value.conditions.ratingGte !== undefined
              ? { ratingGte: Number(rule.value.conditions.ratingGte) }
              : {}),
            ...(rule.value.conditions.solo !== undefined
              ? { solo: Boolean(rule.value.conditions.solo) }
              : {}),
            ...(rule.value.conditions.hostOnly !== undefined
              ? { hostOnly: Boolean(rule.value.conditions.hostOnly) }
              : {}),
          },
        }
      : {}),
  };

  const payload = {
    category: 'xp',
    name: rule.name,
    description: rule.description,
    value: JSON.stringify(normalizedValue),
    enabled: true,
  };

  if (!existing) {
    await ExtraModel.create({
      extraCode: await generateExtraCode(),
      ...payload,
    });

    return 'created';
  }

  existing.description = payload.description;
  existing.value = payload.value;
  existing.enabled = payload.enabled;
  await existing.save();

  return 'updated';
}

async function run() {
  const mongoUri = readMongoUri();
  await mongoose.connect(mongoUri);

  const rules = defaultRules();
  let created = 0;
  let updated = 0;

  for (const rule of rules) {
    const status = await upsertRule(rule);

    if (status === 'created') {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`XP seed finished. created=${created}, updated=${updated}, total=${rules.length}`);
}

run()
  .catch((error) => {
    console.error('XP seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
