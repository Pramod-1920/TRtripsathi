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
  baseXp: number;
  overrideXp?: number;
  bonusXp?: number;
  socialBonusXp?: number;
  ruleType: 'activity' | 'location' | 'global' | 'social';
  activityType?: string;
  locationKey?: string;
  overrideEnabled?: boolean;
  repeatPenaltyEnabled?: boolean;
  difficultyMultipliers?: Partial<Record<'easy' | 'moderate' | 'hard' | 'extreme', number>>;
  explorationBonuses?: {
    firstVisit?: number;
    newDistrict?: number;
    hiddenGem?: number;
    rareRoute?: number;
  };
  repeat: XpRuleRepeatMode;
  conditions?: {
    difficulty?: string;
    district?: string;
    locationKey?: string;
    activityType?: string;
    ratingGte?: number;
    solo?: boolean;
    hostOnly?: boolean;
    hiddenGem?: boolean;
    rareRoute?: boolean;
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
      name: 'Activity Rule: Hike',
      description: 'Dynamic XP rule for hike activities',
      value: {
        eventKey: 'campaign_completed',
        ruleType: 'activity',
        activityType: 'hike',
        baseXp: 50,
        difficultyMultipliers: {
          easy: 1,
          moderate: 1.4,
          hard: 1.9,
          extreme: 2.5,
        },
        explorationBonuses: {
          firstVisit: 150,
          newDistrict: 250,
          hiddenGem: 300,
          rareRoute: 400,
        },
        repeatPenaltyEnabled: true,
        repeat: 'once_per_campaign',
        conditions: { activityType: 'hike' },
      },
    },
    {
      name: 'Activity Rule: Trek',
      description: 'Dynamic XP rule for trek activities',
      value: {
        eventKey: 'campaign_completed',
        ruleType: 'activity',
        activityType: 'trek',
        baseXp: 100,
        difficultyMultipliers: {
          easy: 1,
          moderate: 1.3,
          hard: 1.8,
          extreme: 2.4,
        },
        explorationBonuses: {
          firstVisit: 150,
          newDistrict: 250,
          hiddenGem: 300,
          rareRoute: 400,
        },
        repeatPenaltyEnabled: true,
        repeat: 'once_per_campaign',
        conditions: { activityType: 'trek' },
      },
    },
    {
      name: 'Activity Rule: Temple / Heritage',
      description: 'Dynamic XP rule for temple and heritage visits',
      value: {
        eventKey: 'campaign_completed',
        ruleType: 'activity',
        activityType: 'temple',
        baseXp: 90,
        difficultyMultipliers: {
          easy: 1,
          moderate: 1.2,
          hard: 1.6,
          extreme: 2,
        },
        explorationBonuses: {
          firstVisit: 150,
          newDistrict: 250,
          hiddenGem: 300,
          rareRoute: 400,
        },
        repeatPenaltyEnabled: true,
        repeat: 'once_per_campaign',
        conditions: { activityType: 'temple' },
      },
    },
    {
      name: 'Activity Rule: Adventure',
      description: 'Dynamic XP rule for nature adventure campaigns',
      value: {
        eventKey: 'campaign_completed',
        ruleType: 'activity',
        activityType: 'adventure',
        baseXp: 120,
        difficultyMultipliers: {
          easy: 1,
          moderate: 1.4,
          hard: 1.9,
          extreme: 2.6,
        },
        explorationBonuses: {
          firstVisit: 150,
          newDistrict: 250,
          hiddenGem: 300,
          rareRoute: 400,
        },
        repeatPenaltyEnabled: true,
        repeat: 'once_per_campaign',
        conditions: { activityType: 'adventure' },
      },
    },
    {
      name: 'Host Campaign Completed XP',
      description: 'XP for successfully hosting and completing a campaign',
      value: {
        eventKey: 'host_campaign_completed',
        ruleType: 'social',
        baseXp: 100,
        socialBonusXp: 180,
        repeatPenaltyEnabled: true,
        repeat: 'once_per_campaign',
        conditions: { hostOnly: true },
      },
    },
    {
      name: 'Group Photo Upload XP',
      description: 'XP for uploading a group campaign photo',
      value: {
        eventKey: 'group_photo_uploaded',
        ruleType: 'global',
        baseXp: 25,
        repeatPenaltyEnabled: false,
        repeat: 'once_per_campaign',
      },
    },
    {
      name: 'Solo Traveller Photo Upload XP',
      description: 'XP for uploading solo trek photo',
      value: {
        eventKey: 'solo_photo_uploaded',
        ruleType: 'global',
        baseXp: 35,
        repeatPenaltyEnabled: false,
        repeat: 'once_per_campaign',
        conditions: { solo: true },
      },
    },
    {
      name: 'First Solo Trek XP',
      description: 'Bonus XP for first solo trek completion',
      value: {
        eventKey: 'first_solo_trek',
        ruleType: 'global',
        baseXp: 120,
        repeatPenaltyEnabled: false,
        repeat: 'once_per_user',
        conditions: { solo: true },
      },
    },
    {
      name: 'First Trek In New District XP',
      description: 'XP bonus when user completes first trek in a district',
      value: {
        eventKey: 'first_trek_new_district',
        ruleType: 'location',
        baseXp: 100,
        bonusXp: 80,
        repeatPenaltyEnabled: false,
        repeat: 'once_per_district',
      },
    },
    {
      name: 'Received Five Star Rating XP',
      description: 'XP bonus for receiving 5-star review from group members',
      value: {
        eventKey: 'received_five_star_rating',
        ruleType: 'social',
        baseXp: 70,
        repeatPenaltyEnabled: false,
        repeat: 'always',
        conditions: { ratingGte: 5 },
      },
    },
    {
      name: 'Referral Completed Trek XP',
      description: 'XP bonus when referred user completes a trek',
      value: {
        eventKey: 'referral_completed_trek',
        ruleType: 'social',
        baseXp: 90,
        socialBonusXp: 250,
        repeatPenaltyEnabled: false,
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
    ruleType: rule.value.ruleType,
    baseXp: Math.floor(rule.value.baseXp),
    ...(rule.value.overrideXp !== undefined
      ? { overrideXp: Math.floor(rule.value.overrideXp) }
      : {}),
    ...(rule.value.bonusXp !== undefined
      ? { bonusXp: Math.floor(rule.value.bonusXp) }
      : {}),
    ...(rule.value.socialBonusXp !== undefined
      ? { socialBonusXp: Math.floor(rule.value.socialBonusXp) }
      : {}),
    ...(rule.value.activityType
      ? { activityType: normalizeKey(rule.value.activityType) }
      : {}),
    ...(rule.value.locationKey
      ? { locationKey: normalizeKey(rule.value.locationKey) }
      : {}),
    ...(rule.value.overrideEnabled !== undefined
      ? { overrideEnabled: Boolean(rule.value.overrideEnabled) }
      : {}),
    ...(rule.value.repeatPenaltyEnabled !== undefined
      ? { repeatPenaltyEnabled: Boolean(rule.value.repeatPenaltyEnabled) }
      : {}),
    ...(rule.value.difficultyMultipliers
      ? { difficultyMultipliers: rule.value.difficultyMultipliers }
      : {}),
    ...(rule.value.explorationBonuses
      ? { explorationBonuses: rule.value.explorationBonuses }
      : {}),
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
            ...(rule.value.conditions.locationKey
              ? { locationKey: normalizeKey(rule.value.conditions.locationKey) }
              : {}),
            ...(rule.value.conditions.activityType
              ? { activityType: normalizeKey(rule.value.conditions.activityType) }
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
            ...(rule.value.conditions.hiddenGem !== undefined
              ? { hiddenGem: Boolean(rule.value.conditions.hiddenGem) }
              : {}),
            ...(rule.value.conditions.rareRoute !== undefined
              ? { rareRoute: Boolean(rule.value.conditions.rareRoute) }
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
