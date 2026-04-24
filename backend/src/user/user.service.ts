import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Auth } from '../auth/schemas/auth.schema';
import { ExperienceLevel } from '../auth/constants/experience-level.enum';
import { CloudinaryService } from '../config/cloudinary/cloudinary.service';
import { ExtraCategory } from '../extra/constants/extra-category.enum';
import { ExtraItem } from '../extra/schemas/extra.schema';
import { Gender } from './constants/gender.enum';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './schemas/user.schema';

type LevelUpRule = {
  rankCode: string;
  requiredXp: number;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: {
    hikes?: number;
    treks?: number;
    temples?: number;
    difficultRoutes?: number;
    legendaryRoutes?: number;
    questChains?: number;
  };
};

type LevelUpRuleValue = {
  requiredXp: number;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: {
    hikes?: number;
    treks?: number;
    temples?: number;
    difficultRoutes?: number;
    legendaryRoutes?: number;
    questChains?: number;
  };
};

type AchievementDefinition = {
  key: string;
  title: string;
  description?: string;
  subcategory: string;
  targetCount: number;
  hidden?: boolean;
};

type XpRuleRepeatMode =
  | 'always'
  | 'once_per_user'
  | 'once_per_campaign'
  | 'once_per_district'
  | 'once_per_difficulty'
  | 'once_per_referred_user';

type XpRuleDefinition = {
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

type ParsedXpRule = {
  code: string;
  name: string;
  eventKey: string;
  points: number;
  repeat: XpRuleRepeatMode;
  conditions?: XpRuleDefinition['conditions'];
};

type XpEventContext = {
  campaignId?: string;
  district?: string;
  difficulty?: string;
  rating?: number;
  solo?: boolean;
  hostOnly?: boolean;
  referredUserId?: string;
  [key: string]: unknown;
};

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Auth.name) private readonly authModel: Model<Auth>,
    @InjectModel(ExtraItem.name) private readonly extraModel: Model<ExtraItem>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    return new Types.ObjectId(id);
  }

  private calculateAge(dateOfBirth: Date) {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private sanitizeProfileUpdates(updates: Record<string, unknown>) {
    const allowedKeys = [
      'firstName',
      'middleName',
      'lastName',
      'profilePhoto',
      'profilePhotoPublicId',
      'bio',
      'location',
      'province',
      'district',
      'landmark',
      'experienceLevel',
      'level',
      'gender',
      'languagesKnown',
      'isProfilePublic',
      'dateOfBirth',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        sanitized[key] = updates[key];
      }
    }

    if (sanitized.dateOfBirth) {
      const parsedDate = new Date(String(sanitized.dateOfBirth));

      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid date of birth');
      }

      const calculatedAge = this.calculateAge(parsedDate);

      if (calculatedAge < 9 || calculatedAge > 120) {
        throw new BadRequestException(
          'Date of birth must result in age between 9 and 120',
        );
      }

      sanitized.dateOfBirth = parsedDate;
      sanitized.age = calculatedAge;
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'gender')) {
      const gender = sanitized.gender;

      if (
        gender !== null &&
        gender !== undefined &&
        !Object.values(Gender).includes(gender as Gender)
      ) {
        throw new BadRequestException('Invalid gender');
      }
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'languagesKnown')) {
      if (!Array.isArray(sanitized.languagesKnown)) {
        throw new BadRequestException('Languages must be an array');
      }

      sanitized.languagesKnown = sanitized.languagesKnown
        .map((language) => String(language).trim())
        .filter((language) => language.length > 0);
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'level')) {
      const rawLevel = Number(sanitized.level);

      if (!Number.isFinite(rawLevel) || rawLevel < 1) {
        throw new BadRequestException('Level must be a number greater than or equal to 1');
      }

      sanitized.level = Math.floor(rawLevel);
    }

    return sanitized;
  }

  private parseLevelUpRuleValue(
    value?: string | null,
  ): LevelUpRuleValue | null {
    if (!value?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<LevelUpRuleValue>;
      const requiredXp = Number(parsed.requiredXp);

      if (!Number.isFinite(requiredXp) || requiredXp < 0) {
        return null;
      }

      const requirements = parsed.requirements
        ? {
            ...(parsed.requirements.hikes !== undefined
              ? { hikes: Number(parsed.requirements.hikes) }
              : {}),
            ...(parsed.requirements.treks !== undefined
              ? { treks: Number(parsed.requirements.treks) }
              : {}),
            ...(parsed.requirements.temples !== undefined
              ? { temples: Number(parsed.requirements.temples) }
              : {}),
            ...(parsed.requirements.difficultRoutes !== undefined
              ? { difficultRoutes: Number(parsed.requirements.difficultRoutes) }
              : {}),
            ...(parsed.requirements.legendaryRoutes !== undefined
              ? { legendaryRoutes: Number(parsed.requirements.legendaryRoutes) }
              : {}),
            ...(parsed.requirements.questChains !== undefined
              ? { questChains: Number(parsed.requirements.questChains) }
              : {}),
          }
        : undefined;

      return {
        requiredXp: Math.floor(requiredXp),
        ...(parsed.title ? { title: String(parsed.title).trim() } : {}),
        ...(parsed.feeling ? { feeling: String(parsed.feeling).trim() } : {}),
        ...(parsed.requireRank
          ? { requireRank: String(parsed.requireRank).trim() }
          : {}),
        ...(parsed.hidden ? { hidden: true } : {}),
        ...(requirements ? { requirements } : {}),
      };
    } catch {
      const requiredXp = Number(value);

      if (!Number.isFinite(requiredXp) || requiredXp < 0) {
        return null;
      }

      return {
        requiredXp: Math.floor(requiredXp),
      };
    }
  }

  private isExperienceLevel(value: string): value is ExperienceLevel {
    return Object.values(ExperienceLevel).includes(value as ExperienceLevel);
  }

  private normalizeKey(value?: string | null) {
    return value?.trim().toLowerCase() ?? '';
  }

  private parseXpRuleValue(value?: string | null): XpRuleDefinition | null {
    if (!value?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<XpRuleDefinition>;
      const eventKey = this.normalizeKey(parsed.eventKey);
      const points = Number(parsed.points);
      const repeat = parsed.repeat ?? 'always';

      if (!eventKey || !Number.isFinite(points) || points <= 0) {
        return null;
      }

      const allowedRepeats: XpRuleRepeatMode[] = [
        'always',
        'once_per_user',
        'once_per_campaign',
        'once_per_district',
        'once_per_difficulty',
        'once_per_referred_user',
      ];

      if (!allowedRepeats.includes(repeat as XpRuleRepeatMode)) {
        return null;
      }

      const conditions = parsed.conditions
        ? {
            ...(parsed.conditions.difficulty
              ? { difficulty: this.normalizeKey(String(parsed.conditions.difficulty)) }
              : {}),
            ...(parsed.conditions.district
              ? { district: this.normalizeKey(String(parsed.conditions.district)) }
              : {}),
            ...(parsed.conditions.ratingGte !== undefined
              ? { ratingGte: Number(parsed.conditions.ratingGte) }
              : {}),
            ...(parsed.conditions.solo !== undefined
              ? { solo: Boolean(parsed.conditions.solo) }
              : {}),
            ...(parsed.conditions.hostOnly !== undefined
              ? { hostOnly: Boolean(parsed.conditions.hostOnly) }
              : {}),
          }
        : undefined;

      if (conditions?.ratingGte !== undefined && !Number.isFinite(conditions.ratingGte)) {
        return null;
      }

      return {
        eventKey,
        points: Math.floor(points),
        repeat: repeat as XpRuleRepeatMode,
        ...(conditions ? { conditions } : {}),
      };
    } catch {
      const points = Number(value);

      if (!Number.isFinite(points) || points <= 0) {
        return null;
      }

      // Backward-compatible fallback: numeric value means manual points rule.
      return {
        eventKey: 'manual',
        points: Math.floor(points),
        repeat: 'always',
      };
    }
  }

  private async getEnabledXpRules(): Promise<ParsedXpRule[]> {
    const items = await this.extraModel
      .find({
        category: ExtraCategory.Xp,
        enabled: { $ne: false },
      })
      .sort({ createdAt: 1 });

    return items
      .map((item) => {
        const parsed = this.parseXpRuleValue(item.value);

        if (!parsed || !item.name?.trim() || !item.extraCode?.trim()) {
          return null;
        }

        return {
          code: item.extraCode.trim(),
          name: item.name.trim(),
          eventKey: parsed.eventKey,
          points: parsed.points,
          repeat: parsed.repeat,
          ...(parsed.conditions ? { conditions: parsed.conditions } : {}),
        } as ParsedXpRule;
      })
      .filter((item): item is ParsedXpRule => Boolean(item));
  }

  private parseAchievementValue(value?: string | null) {
    if (!value?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<{
        key: string;
        subcategory: string;
        targetCount: number;
        hidden?: boolean;
      }>;

      if (!parsed.key || !parsed.subcategory || parsed.targetCount === undefined) {
        return null;
      }

      const targetCount = Number(parsed.targetCount);

      if (!Number.isFinite(targetCount) || targetCount < 1) {
        return null;
      }

      return {
        key: String(parsed.key).trim(),
        subcategory: String(parsed.subcategory).trim(),
        targetCount: Math.floor(targetCount),
        ...(parsed.hidden ? { hidden: true } : {}),
      };
    } catch {
      return null;
    }
  }

  private async getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    const items = await this.extraModel
      .find({ category: ExtraCategory.Achievement, enabled: { $ne: false } })
      .sort({ createdAt: 1 });

    return items
      .map((item) => {
        const parsed = this.parseAchievementValue(item.value);

        if (!parsed || !item.name?.trim()) {
          return null;
        }

        return {
          key: parsed.key,
          title: item.name.trim(),
          description: item.description ?? undefined,
          subcategory: parsed.subcategory,
          targetCount: parsed.targetCount,
          ...(parsed.hidden ? { hidden: true } : {}),
        };
      })
      .filter(Boolean) as AchievementDefinition[];
  }

  private normalizeAchievementSubcategory(value: string) {
    return this.normalizeKey(value).replace(/\s+/g, '_');
  }

  async recordAchievementEvent(
    authId: string,
    payload: {
      subcategory: string;
      key?: string;
      count?: number;
    },
  ) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const increment = Math.max(1, Math.floor(Number(payload.count ?? 1)));
    const subcategory = this.normalizeAchievementSubcategory(payload.subcategory);
    const definitions = await this.getAchievementDefinitions();
    const filtered = definitions.filter((definition) => {
      if (payload.key?.trim()) {
        return (
          definition.key.toLowerCase() === payload.key.trim().toLowerCase()
          && this.normalizeAchievementSubcategory(definition.subcategory) === subcategory
        );
      }

      return this.normalizeAchievementSubcategory(definition.subcategory) === subcategory;
    });

    const stats = {
      hikes: profile.achievementStats?.hikes ?? 0,
      treks: profile.achievementStats?.treks ?? 0,
      temples: profile.achievementStats?.temples ?? 0,
      difficultRoutes: profile.achievementStats?.difficultRoutes ?? 0,
      legendaryRoutes: profile.achievementStats?.legendaryRoutes ?? 0,
      questChains: profile.achievementStats?.questChains ?? 0,
    };

    const statMap: Record<string, keyof typeof stats> = {
      hikes: 'hikes',
      hike: 'hikes',
      treks: 'treks',
      trek: 'treks',
      temples: 'temples',
      temple: 'temples',
      difficult_routes: 'difficultRoutes',
      difficult_route: 'difficultRoutes',
      legendary_routes: 'legendaryRoutes',
      legendary_route: 'legendaryRoutes',
      quest_chain: 'questChains',
      quest_chains: 'questChains',
    };

    const statKey = statMap[subcategory];
    if (statKey) {
      stats[statKey] += increment;
    }

    const progress = [...(profile.achievementProgress ?? [])];
    const unlocked: Array<{ key: string; title: string }> = [];

    for (const definition of filtered) {
      const index = progress.findIndex(
        (entry) => entry.key.toLowerCase() === definition.key.toLowerCase(),
      );

      const existing = index >= 0
        ? progress[index]
        : {
            key: definition.key,
            title: definition.title,
            subcategory: definition.subcategory,
            count: 0,
            target: definition.targetCount,
            hidden: definition.hidden ?? false,
          };

      const nextCount = Math.min(
        definition.targetCount,
        (existing.count ?? 0) + increment,
      );

      const completed = Boolean(existing.completedAt);
      const completedAt = completed
        ? existing.completedAt
        : nextCount >= definition.targetCount
          ? new Date()
          : undefined;

      const updatedEntry = {
        ...existing,
        count: nextCount,
        target: definition.targetCount,
        updatedAt: new Date(),
        ...(completedAt ? { completedAt } : {}),
      };

      if (index >= 0) {
        progress[index] = updatedEntry;
      } else {
        progress.push(updatedEntry);
      }

      if (!completed && completedAt) {
        unlocked.push({ key: definition.key, title: definition.title });
      }
    }

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        achievementStats: stats,
        achievementProgress: progress,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const previousRank = profile.experienceLevel ?? ExperienceLevel.E;
    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );
    const newRank = syncedProfile.experienceLevel ?? previousRank;

    return {
      subcategory,
      increment,
      stats,
      unlocked,
      rankUnlocked: newRank !== previousRank,
      previousRank,
      newRank,
    };
  }

  private doesContextMatchRule(rule: ParsedXpRule, context: XpEventContext) {
    if (!rule.conditions) {
      return true;
    }

    if (
      rule.conditions.difficulty
      && this.normalizeKey(String(context.difficulty ?? '')) !== rule.conditions.difficulty
    ) {
      return false;
    }

    if (
      rule.conditions.district
      && this.normalizeKey(String(context.district ?? '')) !== rule.conditions.district
    ) {
      return false;
    }

    if (rule.conditions.solo !== undefined && Boolean(context.solo) !== rule.conditions.solo) {
      return false;
    }

    if (rule.conditions.hostOnly !== undefined && Boolean(context.hostOnly) !== rule.conditions.hostOnly) {
      return false;
    }

    if (rule.conditions.ratingGte !== undefined) {
      const rating = Number(context.rating ?? Number.NaN);

      if (!Number.isFinite(rating) || rating < rule.conditions.ratingGte) {
        return false;
      }
    }

    return true;
  }

  private buildXpContextKey(rule: ParsedXpRule, context: XpEventContext) {
    switch (rule.repeat) {
      case 'once_per_user':
        return `${rule.code}:once_per_user`;
      case 'once_per_campaign':
        return `${rule.code}:campaign:${String(context.campaignId ?? '').trim().toLowerCase()}`;
      case 'once_per_district':
        return `${rule.code}:district:${this.normalizeKey(String(context.district ?? ''))}`;
      case 'once_per_difficulty':
        return `${rule.code}:difficulty:${this.normalizeKey(String(context.difficulty ?? ''))}`;
      case 'once_per_referred_user':
        return `${rule.code}:ref:${String(context.referredUserId ?? '').trim().toLowerCase()}`;
      case 'always':
      default:
        return `${rule.code}:always:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  private hasSufficientRepeatContext(rule: ParsedXpRule, context: XpEventContext) {
    if (rule.repeat === 'once_per_campaign') {
      return Boolean(String(context.campaignId ?? '').trim());
    }

    if (rule.repeat === 'once_per_district') {
      return Boolean(this.normalizeKey(String(context.district ?? '')));
    }

    if (rule.repeat === 'once_per_difficulty') {
      return Boolean(this.normalizeKey(String(context.difficulty ?? '')));
    }

    if (rule.repeat === 'once_per_referred_user') {
      return Boolean(String(context.referredUserId ?? '').trim());
    }

    return true;
  }

  private async getLevelUpRules(): Promise<LevelUpRule[]> {
    const items = await this.extraModel
      .find({
        category: ExtraCategory.LevelUp,
        enabled: { $ne: false },
      })
      .sort({ createdAt: 1 });

    return items
      .map((item) => {
        const parsed = this.parseLevelUpRuleValue(item.value);
        const rankCode = item.name?.trim();

        if (!parsed || !rankCode) {
          return null;
        }

        return {
          rankCode,
          requiredXp: parsed.requiredXp,
          ...(parsed.title ? { title: parsed.title } : {}),
          ...(parsed.feeling ? { feeling: parsed.feeling } : {}),
          ...(parsed.requireRank ? { requireRank: parsed.requireRank } : {}),
          ...(parsed.hidden ? { hidden: true } : {}),
          ...(parsed.requirements ? { requirements: parsed.requirements } : {}),
        };
      })
      .filter((item): item is LevelUpRule => Boolean(item))
      .sort((first, second) => first.requiredXp - second.requiredXp);
  }

  private getAchievementStats(profile: User) {
    return {
      hikes: profile.achievementStats?.hikes ?? 0,
      treks: profile.achievementStats?.treks ?? 0,
      temples: profile.achievementStats?.temples ?? 0,
      difficultRoutes: profile.achievementStats?.difficultRoutes ?? 0,
      legendaryRoutes: profile.achievementStats?.legendaryRoutes ?? 0,
      questChains: profile.achievementStats?.questChains ?? 0,
    };
  }

  private meetsLevelUpRequirements(rule: LevelUpRule, profile: User) {
    if (!rule.requirements) {
      return true;
    }

    const stats = this.getAchievementStats(profile);
    const requirements = rule.requirements;

    if (requirements.hikes !== undefined && stats.hikes < requirements.hikes) {
      return false;
    }

    if (requirements.treks !== undefined && stats.treks < requirements.treks) {
      return false;
    }

    if (requirements.temples !== undefined && stats.temples < requirements.temples) {
      return false;
    }

    if (
      requirements.difficultRoutes !== undefined
      && stats.difficultRoutes < requirements.difficultRoutes
    ) {
      return false;
    }

    if (
      requirements.legendaryRoutes !== undefined
      && stats.legendaryRoutes < requirements.legendaryRoutes
    ) {
      return false;
    }

    if (
      requirements.questChains !== undefined
      && stats.questChains < requirements.questChains
    ) {
      return false;
    }

    return true;
  }

  private meetsRankGate(rule: LevelUpRule, currentRank: string) {
    if (!rule.requireRank) {
      return true;
    }

    return rule.requireRank.trim().toLowerCase() === currentRank.trim().toLowerCase();
  }

  private async buildNextRankProgress(profile: User, rules?: LevelUpRule[]) {
    const rulesList = rules ?? await this.getLevelUpRules();

    if (rulesList.length === 0) {
      return null;
    }

    const currentRankCode = String(
      profile.experienceLevel ?? rulesList[0].rankCode,
    );
    const currentIndex = Math.max(
      0,
      rulesList.findIndex(
        (rule) => rule.rankCode.trim().toLowerCase()
          === currentRankCode.trim().toLowerCase(),
      ),
    );
    const nextRule = rulesList[currentIndex + 1];

    if (!nextRule) {
      return null;
    }

    const currentXp = Math.max(0, Math.floor(Number(profile.xp ?? 0)));
    const remainingXp = Math.max(0, nextRule.requiredXp - currentXp);
    const stats = this.getAchievementStats(profile);
    const requirements = nextRule.requirements ?? {};
    const remainingRequirements = {
      ...(requirements.hikes !== undefined
        ? { hikes: Math.max(0, requirements.hikes - stats.hikes) }
        : {}),
      ...(requirements.treks !== undefined
        ? { treks: Math.max(0, requirements.treks - stats.treks) }
        : {}),
      ...(requirements.temples !== undefined
        ? { temples: Math.max(0, requirements.temples - stats.temples) }
        : {}),
      ...(requirements.difficultRoutes !== undefined
        ? {
            difficultRoutes: Math.max(
              0,
              requirements.difficultRoutes - stats.difficultRoutes,
            ),
          }
        : {}),
      ...(requirements.legendaryRoutes !== undefined
        ? {
            legendaryRoutes: Math.max(
              0,
              requirements.legendaryRoutes - stats.legendaryRoutes,
            ),
          }
        : {}),
      ...(requirements.questChains !== undefined
        ? {
            questChains: Math.max(
              0,
              requirements.questChains - stats.questChains,
            ),
          }
        : {}),
    };

    const eligible =
      remainingXp === 0
      && Object.values(remainingRequirements).every((value) => value === 0)
      && this.meetsRankGate(nextRule, currentRankCode)
      && this.meetsLevelUpRequirements(nextRule, profile);

    if (nextRule.hidden && !eligible) {
      return {
        nextRankHidden: true,
      };
    }

    return {
      nextRank: nextRule.rankCode,
      requiredXp: nextRule.requiredXp,
      remainingXp,
      requiredAchievements: requirements,
      remainingAchievements: remainingRequirements,
      nextRankHidden: false,
    };
  }

  private async applyLevelProgression(profile: User, rules?: LevelUpRule[]) {
    const levelUpRules = rules ?? await this.getLevelUpRules();

    if (levelUpRules.length === 0) {
      return profile;
    }

    const currentRankCode = String(
      profile.experienceLevel ?? levelUpRules[0].rankCode,
    );
    const normalizedRank = currentRankCode.trim().toLowerCase();
    const currentIndex = Math.max(
      0,
      levelUpRules.findIndex(
        (rule) => rule.rankCode.trim().toLowerCase() === normalizedRank,
      ),
    );

    const nextRule = levelUpRules[currentIndex + 1];
    const currentXp = Math.max(0, Math.floor(Number(profile.xp ?? 0)));
    const nextRankReached = Boolean(
      nextRule
        && Number.isFinite(nextRule.requiredXp)
        && currentXp >= nextRule.requiredXp
        && this.meetsLevelUpRequirements(nextRule, profile)
        && this.meetsRankGate(nextRule, normalizedRank),
    );

    const nextRankCode = nextRankReached
      ? nextRule.rankCode
      : levelUpRules[currentIndex].rankCode;

    const nextLevel = Math.max(1, currentIndex + (nextRankReached ? 2 : 1));
    const nextXp = nextRankReached ? 0 : currentXp;

    const shouldUpdate =
      profile.level !== nextLevel
      || (profile.experienceLevel ?? levelUpRules[0].rankCode) !== nextRankCode
      || profile.xp !== nextXp;

    if (!shouldUpdate) {
      return profile;
    }

    const updated = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        level: nextLevel,
        experienceLevel: nextRankCode,
        xp: nextXp,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return updated ?? profile;
  }

  async awardXpForEvent(
    authId: string,
    eventKey: string,
    context: XpEventContext = {},
  ) {
    const normalizedEventKey = this.normalizeKey(eventKey);

    if (!normalizedEventKey) {
      throw new BadRequestException('eventKey is required');
    }

    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const rules = await this.getEnabledXpRules();
    const matchingRules = rules.filter(
      (rule) => rule.eventKey === normalizedEventKey,
    );

    if (matchingRules.length === 0) {
      return {
        eventKey: normalizedEventKey,
        totalAwarded: 0,
        appliedRules: [],
      };
    }

    const existingHistory = profile.xpHistory ?? [];
    const updates: NonNullable<User['xpHistory']> = [];

    for (const rule of matchingRules) {
      if (!this.hasSufficientRepeatContext(rule, context)) {
        continue;
      }

      if (!this.doesContextMatchRule(rule, context)) {
        continue;
      }

      const contextKey = this.buildXpContextKey(rule, context);
      const alreadyAwarded =
        rule.repeat !== 'always'
        && existingHistory.some((entry) => entry.contextKey === contextKey);

      if (alreadyAwarded) {
        continue;
      }

      updates.push({
        eventKey: normalizedEventKey,
        ruleCode: rule.code,
        ruleName: rule.name,
        points: rule.points,
        contextKey,
        context,
        awardedAt: new Date(),
      });
    }

    if (updates.length === 0) {
      return {
        eventKey: normalizedEventKey,
        totalAwarded: 0,
        appliedRules: [],
      };
    }

  const totalAwarded = updates.reduce((total, entry) => total + entry.points, 0);
  const previousRank = profile.experienceLevel ?? ExperienceLevel.E;

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        $inc: { xp: totalAwarded },
        $push: { xpHistory: { $each: updates } },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );

    const newRank = syncedProfile?.experienceLevel ?? previousRank;

    return {
      eventKey: normalizedEventKey,
      totalAwarded,
      currentXp: syncedProfile?.xp ?? profile.xp + totalAwarded,
      appliedRules: updates.map((entry) => ({
        ruleCode: entry.ruleCode,
        ruleName: entry.ruleName,
        points: entry.points,
      })),
      rankUnlocked: newRank !== previousRank,
      previousRank,
      newRank,
    };
  }

  async awardXpForProfileEvent(
    profileId: string,
    eventKey: string,
    context: XpEventContext = {},
  ) {
    const profile = await this.userModel.findById(profileId).select('authId');

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.awardXpForEvent(profile.authId.toString(), eventKey, context);
  }

  async getOwnXpHistory(authId: string, page = 1, limit = 20) {
    const profile = await this.userModel.findOne({ authId: this.toObjectId(authId) });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const history = [...(profile.xpHistory ?? [])].sort(
      (first, second) => new Date(second.awardedAt).getTime() - new Date(first.awardedAt).getTime(),
    );

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const startIndex = (safePage - 1) * safeLimit;
    const items = history.slice(startIndex, startIndex + safeLimit);

    return {
      items,
      pagination: {
        total: history.length,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(history.length / safeLimit)),
      },
      currentXp: profile.xp ?? 0,
    };
  }

  async setReferrerForOwnProfile(authId: string, referrerProfileId: string) {
    const profile = await this.userModel.findOne({ authId: this.toObjectId(authId) });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.referredByAuthId) {
      throw new BadRequestException('Referrer is already set for this profile');
    }

    const referrer = await this.userModel.findById(this.toObjectId(referrerProfileId)).select('authId');

    if (!referrer) {
      throw new NotFoundException('Referrer profile not found');
    }

    const normalizedAuthId = this.toObjectId(authId);

    if (referrer.authId.toString() === normalizedAuthId.toString()) {
      throw new BadRequestException('You cannot refer yourself');
    }

    const updated = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        referredByAuthId: referrer.authId,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      throw new NotFoundException('Profile not found');
    }

    return {
      message: 'Referrer linked successfully',
      referredByAuthId: referrer.authId,
    };
  }

  async submitRating(
    authId: string,
    payload: {
      toProfileId: string;
      campaignId: string;
      rating: number;
      comment?: string;
    },
  ) {
    const raterAuthObjectId = this.toObjectId(authId);
    const recipient = await this.userModel.findById(this.toObjectId(payload.toProfileId));

    if (!recipient) {
      throw new NotFoundException('Recipient profile not found');
    }

    if (recipient.authId.toString() === raterAuthObjectId.toString()) {
      throw new BadRequestException('You cannot rate yourself');
    }

    const normalizedCampaignId = String(payload.campaignId).trim();

    if (!normalizedCampaignId) {
      throw new BadRequestException('campaignId is required');
    }

    const ratingEntry = {
      campaignId: normalizedCampaignId,
      raterAuthId: raterAuthObjectId,
      rating: Math.max(1, Math.min(5, Math.floor(Number(payload.rating)))),
      ...(payload.comment?.trim() ? { comment: payload.comment.trim() } : {}),
      createdAt: new Date(),
    };

    const alreadyRated = (recipient.receivedRatings ?? []).some(
      (entry) => entry.campaignId === normalizedCampaignId
        && entry.raterAuthId.toString() === raterAuthObjectId.toString(),
    );

    if (alreadyRated) {
      throw new BadRequestException('You already submitted a rating for this campaign and profile');
    }

    await this.userModel.findByIdAndUpdate(
      recipient._id,
      {
        $push: { receivedRatings: ratingEntry },
      },
      {
        runValidators: true,
      },
    );

    const xpResult = await this.awardXpForEvent(
      recipient.authId.toString(),
      'received_five_star_rating',
      {
        campaignId: normalizedCampaignId,
        rating: ratingEntry.rating,
      },
    );

    return {
      message: 'Rating submitted successfully',
      xp: xpResult,
    };
  }

  async createPhotoVerificationRequest(
    authId: string,
    payload: {
      campaignId: string;
      url: string;
      kind: 'group' | 'solo';
    },
  ) {
    const profile = await this.userModel.findOne({ authId: this.toObjectId(authId) });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const requestCode = `PVR-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const request = {
      requestCode,
      campaignId: String(payload.campaignId).trim(),
      url: String(payload.url).trim(),
      kind: payload.kind,
      status: 'pending' as const,
      submittedAt: new Date(),
    };

    await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        $push: {
          photoVerificationRequests: request,
        },
      },
      {
        runValidators: true,
      },
    );

    return {
      message: 'Photo verification request submitted',
      request,
    };
  }

  async reviewPhotoVerificationRequest(
    profileId: string,
    requestCode: string,
    review: {
      status: 'approved' | 'rejected';
      reviewNote?: string;
    },
    adminAuthId: string,
  ) {
    const profile = await this.userModel.findById(this.toObjectId(profileId));

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const requests = [...(profile.photoVerificationRequests ?? [])];
    const index = requests.findIndex(
      (entry) => entry.requestCode === requestCode,
    );

    if (index === -1) {
      throw new NotFoundException('Photo verification request not found');
    }

    if (requests[index].status !== 'pending') {
      throw new BadRequestException('Photo verification request already reviewed');
    }

    requests[index] = {
      ...requests[index],
      status: review.status,
      reviewedAt: new Date(),
      reviewedByAuthId: this.toObjectId(adminAuthId),
      ...(review.reviewNote?.trim() ? { reviewNote: review.reviewNote.trim() } : {}),
    };

    await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        photoVerificationRequests: requests,
      },
      {
        runValidators: true,
      },
    );

    let xp: Awaited<ReturnType<UserService['awardXpForEvent']>> | null = null;

    if (review.status === 'approved') {
      const eventKey = requests[index].kind === 'solo'
        ? 'solo_photo_uploaded'
        : 'group_photo_uploaded';

      xp = await this.awardXpForEvent(
        profile.authId.toString(),
        eventKey,
        {
          campaignId: requests[index].campaignId,
          solo: requests[index].kind === 'solo',
        },
      );
    }

    return {
      message: `Photo verification request ${review.status}`,
      request: requests[index],
      ...(xp ? { xp } : {}),
    };
  }

  async applyReferralCompletionAwardForUser(completedAuthId: string) {
    const completedProfile = await this.userModel
      .findOne({ authId: this.toObjectId(completedAuthId) })
      .select('referredByAuthId authId');

    if (!completedProfile?.referredByAuthId) {
      return {
        awarded: false,
      };
    }

    const result = await this.awardXpForEvent(
      completedProfile.referredByAuthId.toString(),
      'referral_completed_trek',
      {
        referredUserId: completedProfile.authId.toString(),
      },
    );

    return {
      awarded: result.totalAwarded > 0,
      result,
    };
  }

  private validatePhoneNumber(phoneNumber: string) {
    if (!/^\d{10}$/.test(phoneNumber)) {
      throw new BadRequestException('Phone number must be exactly 10 digits');
    }
  }

  private validateEmail(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
  }

  private async applyAuthContactUpdates(
    authId: string,
    updates: Record<string, unknown>,
  ) {
    const hasPhoneUpdate = Object.prototype.hasOwnProperty.call(
      updates,
      'phoneNumber',
    );
    const hasEmailUpdate = Object.prototype.hasOwnProperty.call(
      updates,
      'email',
    );

    if (!hasPhoneUpdate && !hasEmailUpdate) {
      return;
    }

    const auth = await this.authModel.findById(this.toObjectId(authId));

    if (!auth) {
      throw new NotFoundException('Account not found');
    }

    const authUpdates: Record<string, string | null> = {};

    if (hasPhoneUpdate) {
      const nextPhoneNumber = String(updates.phoneNumber ?? '').trim();
      this.validatePhoneNumber(nextPhoneNumber);

      if (nextPhoneNumber !== auth.phoneNumber) {
        const phoneInUse = await this.authModel.exists({
          phoneNumber: nextPhoneNumber,
          _id: { $ne: auth._id },
        });

        if (phoneInUse) {
          throw new BadRequestException('Phone number is already in use');
        }

        authUpdates.phoneNumber = nextPhoneNumber;
      }
    }

    if (hasEmailUpdate) {
      const rawEmail = updates.email;
      const normalizedEmail =
        rawEmail === null ||
        rawEmail === undefined ||
        String(rawEmail).trim() === ''
          ? null
          : String(rawEmail).trim().toLowerCase();

      if (!normalizedEmail) {
        throw new BadRequestException('Email is required');
      }

      this.validateEmail(normalizedEmail);

      const currentEmail = auth.email ?? null;

      if (normalizedEmail !== currentEmail) {
        if (normalizedEmail) {
          const emailInUse = await this.authModel.exists({
            email: normalizedEmail,
            _id: { $ne: auth._id },
          });

          if (emailInUse) {
            throw new BadRequestException('Email is already in use');
          }
        }

        authUpdates.email = normalizedEmail;
      }
    }

    if (Object.keys(authUpdates).length > 0) {
      await this.authModel.findByIdAndUpdate(auth._id, authUpdates, {
        runValidators: true,
      });
    }
  }

  private async removePreviousImageIfChanged(
    profile: User,
    nextPublicId: string | null | undefined,
  ) {
    if (!nextPublicId) {
      return;
    }

    const previousPublicId = profile.profilePhotoPublicId?.trim();

    if (!previousPublicId || previousPublicId === nextPublicId.trim()) {
      return;
    }

    await this.cloudinaryService.deleteImage(previousPublicId);
  }

  async createProfile(authId: string) {
    const created = await this.userModel.create({
      authId: this.toObjectId(authId),
      profileCompleted: false,
      xp: 0,
      level: 1,
  experienceLevel: ExperienceLevel.E,
      badge: '',
      isProfilePublic: true,
    });

    return this.applyLevelProgression(created);
  }

  async getProfileByAuthId(authId: string) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const syncedProfile = await this.applyLevelProgression(profile);
    return this.attachAuthContactInfo(syncedProfile);
  }

  async getPublicProfileById(profileId: string) {
    const profile = await this.userModel
      .findOne({
        _id: this.toObjectId(profileId),
        isProfilePublic: true,
        profileCompleted: true,
      })
      .select('-authId -xp -badge -updatedAt -__v -profilePhotoPublicId');

    if (!profile) {
      throw new NotFoundException('Public profile not found');
    }

    return {
      ...profile.toObject(),
      level: profile.level ?? 1,
  experienceLevel: profile.experienceLevel ?? ExperienceLevel.E,
    };
  }

  async updateOwnProfile(authId: string, updates: UpdateProfileDto) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.applyAuthContactUpdates(
      authId,
      updates as Record<string, unknown>,
    );

    const sanitizedUpdates = this.sanitizeProfileUpdates(
      updates as Record<string, unknown>,
    );
    const nextPublicId =
      (sanitizedUpdates.profilePhotoPublicId as string | undefined) ??
      undefined;

    await this.removePreviousImageIfChanged(profile, nextPublicId);

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        ...sanitizedUpdates,
        profileCompleted: true,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedProfile) {
      throw new NotFoundException('Profile not found');
    }

    const syncedProfile = await this.applyLevelProgression(updatedProfile);
    return this.attachAuthContactInfo(syncedProfile);
  }

  async deleteOwnProfile(authId: string) {
    const authObjectId = this.toObjectId(authId);
    const profile = await this.userModel.findOneAndDelete({
      authId: authObjectId,
    });

    if (profile?.profilePhotoPublicId) {
      await this.cloudinaryService.deleteImage(profile.profilePhotoPublicId);
    }

    const deletedAuth = await this.authModel.findByIdAndDelete(authObjectId);

    if (!deletedAuth) {
      throw new NotFoundException('Account not found');
    }

    return { message: 'Account deleted successfully' };
  }

  async searchUsers(searchDto: SearchUsersDto) {
    const page = searchDto.page ?? 1;
    const limit = searchDto.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      profileCompleted: true,
      isProfilePublic: true,
    };

    if (searchDto.experienceLevel) {
      filter.experienceLevel = searchDto.experienceLevel;
    }

    if (searchDto.province) {
      filter.province = searchDto.province;
    }

    if (searchDto.district) {
      filter.district = searchDto.district;
    }

    if (searchDto.q?.trim()) {
      const escaped = searchDto.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const queryRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { firstName: queryRegex },
        { lastName: queryRegex },
        { location: queryRegex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-authId -xp -badge -updatedAt -__v -profilePhotoPublicId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.userModel.countDocuments(filter),
    ]);

    const levelUpRules = await this.getLevelUpRules();
    const syncedItems = await Promise.all(
      items.map((item) => this.applyLevelProgression(item, levelUpRules)),
    );

    return {
      items: syncedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAllProfiles(pagination: { page: number; limit: number }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.userModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.userModel.countDocuments(),
    ]);

    const levelUpRules = await this.getLevelUpRules();
    const syncedItems = await Promise.all(
      items.map((item) => this.applyLevelProgression(item, levelUpRules)),
    );

    return {
      items: syncedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProfileById(profileId: string) {
    const profile = await this.userModel.findById(this.toObjectId(profileId));

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const syncedProfile = await this.applyLevelProgression(profile);
    return this.attachAuthContactInfo(syncedProfile);
  }

  async adminUpdateProfile(
    profileId: string,
    updates: Record<string, unknown>,
  ) {
    const profile = await this.userModel.findById(this.toObjectId(profileId));

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.applyAuthContactUpdates(profile.authId.toString(), updates);

    const sanitizedUpdates = this.sanitizeProfileUpdates(updates);
    const nextPublicId =
      (sanitizedUpdates.profilePhotoPublicId as string | undefined) ??
      undefined;

    await this.removePreviousImageIfChanged(profile, nextPublicId);

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      sanitizedUpdates,
      { new: true, runValidators: true },
    );

    if (!updatedProfile) {
      throw new NotFoundException('Profile not found');
    }

    const syncedProfile = await this.applyLevelProgression(updatedProfile);
    return this.attachAuthContactInfo(syncedProfile);
  }

  async adminDeleteProfile(profileId: string) {
    const profile = await this.userModel.findByIdAndDelete(
      this.toObjectId(profileId),
    );

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.profilePhotoPublicId) {
      await this.cloudinaryService.deleteImage(profile.profilePhotoPublicId);
    }

    await this.authModel.findByIdAndDelete(profile.authId);

    return { message: 'Profile deleted successfully' };
  }

  private async attachAuthContactInfo(profile: User) {
    const auth = await this.authModel
      .findById(profile.authId)
      .select('phoneNumber email');

    return {
      ...profile.toObject(),
      phoneNumber: auth?.phoneNumber ?? null,
      email: auth?.email ?? null,
      level: profile.level ?? 1,
  experienceLevel: profile.experienceLevel ?? ExperienceLevel.E,
    };
  }
}
