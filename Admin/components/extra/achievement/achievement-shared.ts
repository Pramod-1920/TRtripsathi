export type AchievementValuePayload = {
  key: string;
  subcategory: string;
  targetCount: number;
  rewardXp: number;
  hidden?: boolean;
};

export type AchievementFormState = {
  title: string;
  description: string;
  key: string;
  subcategory: string;
  targetCount: string;
  rewardXp: string;
  hidden: boolean;
  enabled: boolean;
};

export const defaultAchievementFormState: AchievementFormState = {
  title: '',
  description: '',
  key: '',
  subcategory: '',
  targetCount: '',
  rewardXp: '',
  hidden: false,
  enabled: true,
};

export const achievementSubcategoryPresets = [
  'hikes',
  'treks',
  'temples',
  'routes',
  'unique_locations',
  'difficult_routes',
  'legendary_routes',
  'quest_chains',
  'received_five_star_rating',
  'solo_photo_uploaded',
  'group_photo_uploaded',
  'referral_completed_trek',
  'difficulty_completed',
  'difficulty_easy_completed',
  'difficulty_moderate_completed',
  'difficulty_hard_completed',
  'difficulty_extreme_completed',
  'rank_up',
  'rank_heroic',
  'rank_mythic',
];

export type AchievementTemplate = {
  label: string;
  title: string;
  subcategory: string;
  targetCount: string;
  rewardXp: string;
  description: string;
};

export const achievementTemplates: AchievementTemplate[] = [
  {
    label: 'First Trek',
    title: 'First Trek Completed',
    subcategory: 'treks',
    targetCount: '1',
    rewardXp: '50',
    description: 'Complete your first trek.',
  },
  {
    label: 'Temple Explorer',
    title: 'Temple Explorer',
    subcategory: 'temples',
    targetCount: '10',
    rewardXp: '150',
    description: 'Visit 10 temples.',
  },
  {
    label: 'Hard Route Finisher',
    title: 'Hard Route Finisher',
    subcategory: 'difficult_routes',
    targetCount: '5',
    rewardXp: '250',
    description: 'Complete 5 difficult or extreme routes.',
  },
  {
    label: 'Legend Route Master',
    title: 'Legend Route Master',
    subcategory: 'legendary_routes',
    targetCount: '3',
    rewardXp: '400',
    description: 'Complete 3 extreme routes.',
  },
  {
    label: 'Referral Helper',
    title: 'Referral Helper',
    subcategory: 'referral_completed_trek',
    targetCount: '5',
    rewardXp: '300',
    description: 'Get 5 referred users to complete treks.',
  },
  {
    label: 'Any Difficulty Completions',
    title: 'Difficulty Challenger',
    subcategory: 'difficulty_completed',
    targetCount: '10',
    rewardXp: '220',
    description: 'Complete 10 activities with any difficulty level.',
  },
  {
    label: 'Hard Difficulty Specialist',
    title: 'Hard Difficulty Specialist',
    subcategory: 'difficulty_hard_completed',
    targetCount: '5',
    rewardXp: '260',
    description: 'Complete 5 hard-difficulty activities.',
  },
  {
    label: 'Extreme Difficulty Elite',
    title: 'Extreme Difficulty Elite',
    subcategory: 'difficulty_extreme_completed',
    targetCount: '3',
    rewardXp: '420',
    description: 'Complete 3 extreme-difficulty activities.',
  },
  {
    label: 'Rank Up Milestone',
    title: 'Rank Up Milestone',
    subcategory: 'rank_up',
    targetCount: '3',
    rewardXp: '350',
    description: 'Rank up 3 times.',
  },
  {
    label: 'Reach Heroic Rank',
    title: 'Reach Heroic Rank',
    subcategory: 'rank_heroic',
    targetCount: '1',
    rewardXp: '600',
    description: 'Reach Heroic rank for the first time.',
  },
];

export function parseAchievementValue(rawValue?: string | null): AchievementValuePayload | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AchievementValuePayload>;

    if (!parsed.key || !parsed.subcategory || parsed.targetCount === undefined || parsed.rewardXp === undefined) {
      return null;
    }

    const targetCount = Number(parsed.targetCount);
    const rewardXp = Number(parsed.rewardXp);

    if (!Number.isFinite(targetCount) || targetCount < 1 || !Number.isFinite(rewardXp) || rewardXp < 1) {
      return null;
    }

    return {
      key: String(parsed.key),
      subcategory: String(parsed.subcategory),
      targetCount,
      rewardXp: Math.floor(rewardXp),
      ...(parsed.hidden ? { hidden: true } : {}),
    };
  } catch {
    return null;
  }
}

export function buildAchievementValue(form: AchievementFormState) {
  const targetCount = Number(form.targetCount);

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error('Target count must be a number greater than or equal to 1.');
  }

  if (!form.key.trim()) {
    throw new Error('Key is required.');
  }

  if (!form.subcategory.trim()) {
    throw new Error('Subcategory is required.');
  }

  const rewardXp = Number(form.rewardXp);
  if (!Number.isFinite(rewardXp) || rewardXp < 1) {
    throw new Error('Reward XP is required and must be at least 1.');
  }

  const payload: AchievementValuePayload = {
    key: form.key.trim(),
    subcategory: form.subcategory.trim(),
    targetCount: Math.floor(targetCount),
    rewardXp: Math.floor(rewardXp),
    ...(form.hidden ? { hidden: true } : {}),
  };

  return JSON.stringify(payload);
}
