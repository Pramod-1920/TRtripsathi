import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
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
  minLevel?: number;
  maxLevel?: number;
  subRanks?: string[];
  displayName?: string;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: Record<string, number>;
};

type LevelUpRuleValue = {
  rankCode?: string;
  requiredXp: number;
  minLevel?: number;
  maxLevel?: number;
  subRanks?: string[];
  displayName?: string;
  title?: string;
  feeling?: string;
  requireRank?: string;
  hidden?: boolean;
  requirements?: Record<string, number>;
};

type AchievementDefinition = {
  key: string;
  title: string;
  description?: string;
  subcategory: string;
  targetCount: number;
  rewardXp: number;
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
  points?: number;
  baseXp?: number;
  overrideXp?: number;
  bonusXp?: number;
  socialBonusXp?: number;
  ruleType?: 'activity' | 'location' | 'global' | 'social';
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
    ratingGte?: number;
    solo?: boolean;
    hostOnly?: boolean;
    locationKey?: string;
    activityType?: string;
    hiddenGem?: boolean;
    rareRoute?: boolean;
  };
};

type ParsedXpRule = {
  code: string;
  name: string;
  eventKey: string;
  points: number;
  baseXp: number;
  overrideXp?: number;
  bonusXp: number;
  socialBonusXp: number;
  ruleType: 'activity' | 'location' | 'global' | 'social';
  activityType?: string;
  locationKey?: string;
  overrideEnabled: boolean;
  repeatPenaltyEnabled: boolean;
  difficultyMultipliers: Partial<Record<'easy' | 'moderate' | 'hard' | 'extreme', number>>;
  explorationBonuses: {
    firstVisit: number;
    newDistrict: number;
    hiddenGem: number;
    rareRoute: number;
  };
  repeat: XpRuleRepeatMode;
  conditions?: XpRuleDefinition['conditions'];
};

type XpEventContext = {
  campaignId?: string;
  activityType?: string;
  locationKey?: string;
  placeName?: string;
  district?: string;
  difficulty?: string;
  rating?: number;
  solo?: boolean;
  hostOnly?: boolean;
  hiddenGem?: boolean;
  rareRoute?: boolean;
  firstVisit?: boolean;
  newDistrict?: boolean;
  referredUserId?: string;
  [key: string]: unknown;
};

type XpBreakdown = {
  baseXp: number;
  source: 'override' | 'rule' | 'fallback';
  difficultyMultiplier: number;
  difficultyComponent: number;
  explorationBonus: number;
  socialBonus: number;
  repeatMultiplier: number;
  repeatPenalty: number;
  beforePenalty: number;
  finalXp: number;
  repeatCountForLocation: number;
};

type RankProgressProfile = Pick<
  User,
  'experienceLevel' | 'level' | 'xp' | 'totalXp' | 'achievementStats' | 'achievementProgress'
>;

type RankBadgeRuleValue = {
  imageUrl?: string;
  iconUrl?: string;
  url?: string;
  publicId?: string;
};

type RankBadgeDefinition = {
  rankCode: string;
  imageUrl: string;
  publicId?: string;
  name?: string;
};

type VisibleRankBadge = RankBadgeDefinition & {
  unlocked: true;
  isCurrentRank: boolean;
};

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);
  private readonly rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'Mythic', 'Heroic'] as const;

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

  private getTotalXp(profile: Pick<User, 'xp' | 'totalXp'>) {
    return Math.max(0, Math.floor(Number(profile.totalXp ?? profile.xp ?? 0)));
  }

  private getCurrentRankRule(
    profile: Pick<User, 'experienceLevel' | 'xp' | 'totalXp'>,
    rules: LevelUpRule[],
    totalXp: number,
    rankCode?: string,
  ) {
    const sortedRules = [...rules].sort((first, second) => first.requiredXp - second.requiredXp);
    const normalizedRankCode = this.normalizeRankCode(String(rankCode ?? profile.experienceLevel ?? ''));

    const exactRule = sortedRules.find(
      (rule) => this.normalizeRankCode(rule.rankCode) === normalizedRankCode,
    );

    if (exactRule) {
      return exactRule;
    }

    return [...sortedRules]
      .filter((rule) => Math.max(0, Math.floor(rule.requiredXp)) <= totalXp)
      .pop()
      ?? sortedRules[0];
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
        ? Object.fromEntries(
            Object.entries(parsed.requirements)
              .map(([key, rawValue]): [string, number] => [
                this.normalizeAchievementSubcategory(key),
                Number(rawValue),
              ])
              .filter(([key, value]) => key.length > 0 && Number.isFinite(value) && value > 0)
              .map(([key, value]): [string, number] => [key, Math.floor(value)]),
          )
        : undefined;

      const subRanks = Array.isArray(parsed.subRanks)
        ? parsed.subRanks.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0)
        : typeof parsed.subRanks === 'string'
          ? String(parsed.subRanks)
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
          : undefined;

      return {
        ...(parsed.rankCode ? { rankCode: String(parsed.rankCode).trim() } : {}),
        requiredXp: Math.floor(requiredXp),
        ...(parsed.minLevel !== undefined ? { minLevel: Math.max(1, Math.floor(Number(parsed.minLevel))) } : {}),
        ...(parsed.maxLevel !== undefined ? { maxLevel: Math.max(1, Math.floor(Number(parsed.maxLevel))) } : {}),
        ...(subRanks ? { subRanks } : {}),
        ...(parsed.displayName ? { displayName: String(parsed.displayName).trim() } : {}),
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

  private normalizeRankCode(value?: string | null) {
    const normalized = this.normalizeKey(value);

    if (!normalized) {
      return '';
    }

    const exactMap: Record<string, string> = {
      f: 'F',
      e: 'E',
      d: 'D',
      c: 'C',
      b: 'B',
      a: 'A',
      s: 'S',
      ss: 'SS',
      sss: 'SSS',
      mythic: 'Mythic',
      ultimate: 'Mythic',
      heroic: 'Heroic',
      legend: 'Heroic',
      novice: 'F',
    };

    if (exactMap[normalized]) {
      return exactMap[normalized];
    }

    if (/\(\s*sss\s*\)/i.test(normalized) || normalized.includes('nepal hike god')) {
      return 'SSS';
    }

    if (/\(\s*ss\s*\)/i.test(normalized) || normalized.includes('everest legend')) {
      return 'SS';
    }

    if (/\(\s*s\s*\)/i.test(normalized) || normalized.includes('peak sovereign')) {
      return 'S';
    }

    if (/\(\s*a\s*\)/i.test(normalized) || normalized.includes('himalayan elite')) {
      return 'A';
    }

    if (/\(\s*b\s*\)/i.test(normalized) || normalized.includes('summit conqueror')) {
      return 'B';
    }

    if (/\(\s*c\s*\)/i.test(normalized) || normalized.includes('ridge slayer')) {
      return 'C';
    }

    if (/\(\s*d\s*\)/i.test(normalized) || normalized.includes('trail hunter')) {
      return 'D';
    }

    if (/\(\s*e\s*\)/i.test(normalized) || normalized.includes('novice wanderer')) {
      return 'E';
    }

    if (/\(\s*f\s*\)/i.test(normalized) || normalized.includes('starter')) {
      return 'F';
    }

    if (normalized.includes('heroic') || normalized.includes('himalayan hero')) {
      return 'Heroic';
    }

    if (normalized.includes('himalayan deity') || normalized.includes('nepal conqueror')) {
      return 'Mythic';
    }

    return '';
  }

  private parseRankBadgeValue(value?: string | null): RankBadgeRuleValue | null {
    if (!value?.trim()) {
      return null;
    }

    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed) as Partial<RankBadgeRuleValue>;
      return {
        ...(parsed.imageUrl?.trim() ? { imageUrl: parsed.imageUrl.trim() } : {}),
        ...(parsed.iconUrl?.trim() ? { iconUrl: parsed.iconUrl.trim() } : {}),
        ...(parsed.url?.trim() ? { url: parsed.url.trim() } : {}),
        ...(parsed.publicId?.trim() ? { publicId: parsed.publicId.trim() } : {}),
      };
    } catch {
      if (/^https?:\/\//i.test(trimmed)) {
        return { imageUrl: trimmed };
      }

      return null;
    }
  }

  private getRankOrderIndex(rankCode?: string | null): number {
    const normalizedRank = this.normalizeRankCode(rankCode);

    if (!normalizedRank) {
      return -1;
    }

    return this.rankOrder.findIndex((rank) => rank === normalizedRank);
  }

  private async getRankBadgeDefinitions(): Promise<RankBadgeDefinition[]> {
    const items = await this.extraModel
      .find({
        category: ExtraCategory.Badge,
        enabled: { $ne: false },
      })
      .sort({ createdAt: 1 });

    const byRank = new Map<string, RankBadgeDefinition>();

    for (const item of items) {
      const rankCode = this.normalizeRankCode(item.name?.trim());
      const parsedValue = this.parseRankBadgeValue(item.value);
      const imageUrl = parsedValue?.imageUrl ?? parsedValue?.iconUrl ?? parsedValue?.url;

      if (!rankCode || !imageUrl) {
        continue;
      }

      byRank.set(rankCode, {
        rankCode,
        imageUrl,
        ...(parsedValue?.publicId ? { publicId: parsedValue.publicId } : {}),
        ...(item.name?.trim() ? { name: item.name.trim() } : {}),
      });
    }

    return Array.from(byRank.values()).sort(
      (first, second) => this.getRankOrderIndex(first.rankCode) - this.getRankOrderIndex(second.rankCode),
    );
  }

  private getUnlockedRankBadges(
    currentRankCode: string,
    definitions: RankBadgeDefinition[],
  ): VisibleRankBadge[] {
    const currentRankIndex = this.getRankOrderIndex(currentRankCode);

    if (currentRankIndex < 0) {
      return [];
    }

    return definitions
      .filter((definition) => {
        const definitionIndex = this.getRankOrderIndex(definition.rankCode);
        return definitionIndex >= 0 && definitionIndex <= currentRankIndex;
      })
      .sort((first, second) => this.getRankOrderIndex(second.rankCode) - this.getRankOrderIndex(first.rankCode))
      .map((definition) => ({
        ...definition,
        unlocked: true as const,
        isCurrentRank: this.normalizeRankCode(definition.rankCode) === this.normalizeRankCode(currentRankCode),
      }));
  }

  private normalizeDifficulty(value?: string | null) {
    const normalized = this.normalizeKey(value);

    if (normalized === 'normal') {
      return 'moderate';
    }

    return normalized;
  }

  private getSystemDifficultyBaseXp(difficulty?: string) {
    const normalizedDifficulty = this.normalizeDifficulty(difficulty);

    if (normalizedDifficulty === 'easy') {
      return 50;
    }

    if (normalizedDifficulty === 'hard') {
      return 180;
    }

    if (normalizedDifficulty === 'extreme') {
      return 300;
    }

    return 100;
  }

  private getDefaultRepeatMultiplier(previousCountForLocation: number) {
    const attempt = previousCountForLocation + 1;

    if (attempt === 1) {
      return 1;
    }

    if (attempt === 2) {
      return 0.6;
    }

    if (attempt === 3) {
      return 0.3;
    }

    if (attempt === 4) {
      return 0.1;
    }

    return 0;
  }

  private resolveLocationKey(context: XpEventContext) {
    const explicit = this.normalizeKey(String(context.locationKey ?? context.placeName ?? ''));

    if (explicit) {
      return explicit;
    }

    const district = this.normalizeKey(String(context.district ?? ''));

    if (district) {
      return district;
    }

    return '';
  }

  private resolveDistrictKey(context: XpEventContext) {
    return this.normalizeKey(String(context.district ?? ''));
  }

  private parseXpRuleValue(value?: string | null): XpRuleDefinition | null {
    if (!value?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<XpRuleDefinition>;
      const eventKey = this.normalizeKey(parsed.eventKey);
      const repeat = parsed.repeat ?? 'always';

      const baseXp = Number(
        parsed.baseXp
        ?? parsed.points
        ?? 0,
      );

      const overrideXp = parsed.overrideXp !== undefined
        ? Number(parsed.overrideXp)
        : undefined;

      const bonusXp = parsed.bonusXp !== undefined
        ? Number(parsed.bonusXp)
        : 0;

      const socialBonusXp = parsed.socialBonusXp !== undefined
        ? Number(parsed.socialBonusXp)
        : 0;

      if (!eventKey || !Number.isFinite(baseXp) || baseXp < 0) {
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

      const difficultyMultipliers = parsed.difficultyMultipliers
        ? {
            ...(parsed.difficultyMultipliers.easy !== undefined
              ? { easy: Number(parsed.difficultyMultipliers.easy) }
              : {}),
            ...(parsed.difficultyMultipliers.moderate !== undefined
              ? { moderate: Number(parsed.difficultyMultipliers.moderate) }
              : {}),
            ...(parsed.difficultyMultipliers.hard !== undefined
              ? { hard: Number(parsed.difficultyMultipliers.hard) }
              : {}),
            ...(parsed.difficultyMultipliers.extreme !== undefined
              ? { extreme: Number(parsed.difficultyMultipliers.extreme) }
              : {}),
          }
        : {};

      if (Object.values(difficultyMultipliers).some((value) => !Number.isFinite(value))) {
        return null;
      }

      const explorationBonuses = {
        firstVisit: Number(parsed.explorationBonuses?.firstVisit ?? 150),
        newDistrict: Number(parsed.explorationBonuses?.newDistrict ?? 250),
        hiddenGem: Number(parsed.explorationBonuses?.hiddenGem ?? 300),
        rareRoute: Number(parsed.explorationBonuses?.rareRoute ?? 400),
      };

      if (Object.values(explorationBonuses).some((bonus) => !Number.isFinite(bonus))) {
        return null;
      }

      const conditions = parsed.conditions
        ? {
            ...(parsed.conditions.difficulty
              ? { difficulty: this.normalizeDifficulty(String(parsed.conditions.difficulty)) }
              : {}),
            ...(parsed.conditions.district
              ? { district: this.normalizeKey(String(parsed.conditions.district)) }
              : {}),
            ...(parsed.conditions.locationKey
              ? { locationKey: this.normalizeKey(String(parsed.conditions.locationKey)) }
              : {}),
            ...(parsed.conditions.activityType
              ? { activityType: this.normalizeKey(String(parsed.conditions.activityType)) }
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
            ...(parsed.conditions.hiddenGem !== undefined
              ? { hiddenGem: Boolean(parsed.conditions.hiddenGem) }
              : {}),
            ...(parsed.conditions.rareRoute !== undefined
              ? { rareRoute: Boolean(parsed.conditions.rareRoute) }
              : {}),
          }
        : undefined;

      if (conditions?.ratingGte !== undefined && !Number.isFinite(conditions.ratingGte)) {
        return null;
      }

      return {
        eventKey,
        points: Math.floor(baseXp),
        baseXp: Math.floor(baseXp),
        ...(overrideXp !== undefined && Number.isFinite(overrideXp) && overrideXp >= 0
          ? { overrideXp: Math.floor(overrideXp) }
          : {}),
        ...(Number.isFinite(bonusXp) ? { bonusXp: Math.floor(Math.max(0, bonusXp)) } : {}),
        ...(Number.isFinite(socialBonusXp)
          ? { socialBonusXp: Math.floor(Math.max(0, socialBonusXp)) }
          : {}),
        ...(parsed.ruleType ? { ruleType: parsed.ruleType } : {}),
        ...(parsed.activityType ? { activityType: this.normalizeKey(parsed.activityType) } : {}),
        ...(parsed.locationKey ? { locationKey: this.normalizeKey(parsed.locationKey) } : {}),
        ...(parsed.overrideEnabled !== undefined
          ? { overrideEnabled: Boolean(parsed.overrideEnabled) }
          : {}),
        ...(parsed.repeatPenaltyEnabled !== undefined
          ? { repeatPenaltyEnabled: Boolean(parsed.repeatPenaltyEnabled) }
          : {}),
        ...(Object.keys(difficultyMultipliers).length > 0
          ? { difficultyMultipliers }
          : {}),
        explorationBonuses,
        repeat: repeat as XpRuleRepeatMode,
        ...(conditions ? { conditions } : {}),
      };
    } catch {
      const points = Number(value);

      if (!Number.isFinite(points) || points <= 0) {
        return null;
      }

      return {
        eventKey: 'manual',
        points: Math.floor(points),
        baseXp: Math.floor(points),
        ruleType: 'global',
        overrideEnabled: false,
        repeatPenaltyEnabled: false,
        difficultyMultipliers: {},
        explorationBonuses: {
          firstVisit: 150,
          newDistrict: 250,
          hiddenGem: 300,
          rareRoute: 400,
        },
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
          baseXp: Math.floor(parsed.baseXp ?? parsed.points ?? 0),
          ...(parsed.overrideXp !== undefined ? { overrideXp: parsed.overrideXp } : {}),
          bonusXp: Math.floor(parsed.bonusXp ?? 0),
          socialBonusXp: Math.floor(parsed.socialBonusXp ?? 0),
          ruleType: parsed.ruleType ?? 'global',
          ...(parsed.activityType ? { activityType: parsed.activityType } : {}),
          ...(parsed.locationKey ? { locationKey: parsed.locationKey } : {}),
          overrideEnabled: parsed.overrideEnabled ?? false,
          repeatPenaltyEnabled: parsed.repeatPenaltyEnabled ?? true,
          difficultyMultipliers: parsed.difficultyMultipliers ?? {},
          explorationBonuses: {
            firstVisit: Math.floor(parsed.explorationBonuses?.firstVisit ?? 150),
            newDistrict: Math.floor(parsed.explorationBonuses?.newDistrict ?? 250),
            hiddenGem: Math.floor(parsed.explorationBonuses?.hiddenGem ?? 300),
            rareRoute: Math.floor(parsed.explorationBonuses?.rareRoute ?? 400),
          },
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
        rewardXp?: number;
      }>;

      if (
        !parsed.key
        || !parsed.subcategory
        || parsed.targetCount === undefined
        || parsed.rewardXp === undefined
      ) {
        return null;
      }

      const targetCount = Number(parsed.targetCount);
      const rewardXp = Number(parsed.rewardXp);

      if (
        !Number.isFinite(targetCount)
        || targetCount < 1
        || !Number.isFinite(rewardXp)
        || rewardXp < 1
      ) {
        return null;
      }

      return {
        key: String(parsed.key).trim(),
        subcategory: String(parsed.subcategory).trim(),
        targetCount: Math.floor(targetCount),
        rewardXp: Math.floor(rewardXp),
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
          rewardXp: parsed.rewardXp,
          ...(parsed.hidden ? { hidden: true } : {}),
        };
      })
      .filter(Boolean) as AchievementDefinition[];
  }

  private normalizeAchievementSubcategory(value: string) {
    return this.normalizeKey(value).replace(/\s+/g, '_');
  }

  private buildAutomaticAchievementEventPayloads(
    eventKey: string,
    context: XpEventContext,
    options?: {
      rankUnlocked?: boolean;
      newRank?: string;
    },
  ): Array<{ subcategory: string; count: number }> {
    const normalizedEventKey = this.normalizeAchievementSubcategory(eventKey);
    const normalizedActivityType = this.normalizeAchievementSubcategory(
      String(context.activityType ?? ''),
    );
    const normalizedDifficulty = this.normalizeDifficulty(
      String(context.difficulty ?? ''),
    );
    const locationKey = this.resolveLocationKey(context);
    const payloadCounts = new Map<string, number>();

    const addSubcategory = (rawSubcategory: string, count = 1) => {
      const subcategory = this.normalizeAchievementSubcategory(rawSubcategory);
      if (!subcategory || count <= 0) {
        return;
      }

      payloadCounts.set(
        subcategory,
        (payloadCounts.get(subcategory) ?? 0) + count,
      );
    };

    addSubcategory(normalizedEventKey);
    addSubcategory(normalizedActivityType);

    if (normalizedEventKey.includes('hike')) {
      addSubcategory('hikes');
    }

    if (normalizedEventKey.includes('trek')) {
      addSubcategory('treks');
    }

    if (normalizedEventKey.includes('temple')) {
      addSubcategory('temples');
    }

    if (normalizedEventKey.includes('route')) {
      addSubcategory('routes');
    }

    if (normalizedEventKey.includes('quest')) {
      addSubcategory('quest_chains');
    }

    if (locationKey) {
      addSubcategory('routes');
    }

    if (context.firstVisit === true) {
      addSubcategory('unique_locations');
    }

    if (normalizedDifficulty === 'hard' || normalizedDifficulty === 'extreme') {
      addSubcategory('difficult_routes');
    }

    if (normalizedDifficulty === 'extreme') {
      addSubcategory('legendary_routes');
    }

    if (normalizedDifficulty) {
      addSubcategory('difficulty_completed');
      addSubcategory(`difficulty_${normalizedDifficulty}_completed`);
    }

    if (options?.rankUnlocked) {
      addSubcategory('rank_up');
      const normalizedRank = this.normalizeAchievementSubcategory(
        String(options.newRank ?? ''),
      );
      if (normalizedRank) {
        addSubcategory(`rank_${normalizedRank}`);
      }
    }

    return Array.from(payloadCounts.entries()).map(
      ([subcategory, count]): { subcategory: string; count: number } => ({
        subcategory,
        count,
      }),
    );
  }

  private async recordAutomaticAchievementEvents(
    authId: string,
    eventKey: string,
    context: XpEventContext,
    options?: {
      rankUnlocked?: boolean;
      newRank?: string;
    },
  ) {
    const payloads = this.buildAutomaticAchievementEventPayloads(
      eventKey,
      context,
      options,
    );

    if (payloads.length === 0) {
      return {
        payloads: [],
        unlocked: [],
        rankUnlocked: false,
      };
    }

    const unlockedMap = new Map<
      string,
      { key: string; title: string; rewardXp: number }
    >();
    let rankUnlocked = false;

    for (const payload of payloads) {
      const result = await this.recordAchievementEvent(authId, payload);
      rankUnlocked = rankUnlocked || Boolean(result.rankUnlocked);

      for (const unlocked of result.unlocked) {
        unlockedMap.set(unlocked.key, unlocked);
      }
    }

    return {
      payloads,
      unlocked: Array.from(unlockedMap.values()),
      rankUnlocked,
    };
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

    const stats = Object.fromEntries(
      Object.entries((profile.achievementStats ?? {}) as Record<string, unknown>)
        .map(([key, value]): [string, number] => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value) && value >= 0)
        .map(([key, value]): [string, number] => [key, Math.floor(value)]),
    ) as Record<string, number>;

    const legacyStatMap: Record<string, string> = {
      difficult_routes: 'difficultRoutes',
      difficult_route: 'difficultRoutes',
      legendary_routes: 'legendaryRoutes',
      legendary_route: 'legendaryRoutes',
      quest_chain: 'questChains',
      quest_chains: 'questChains',
    };

    stats[subcategory] = (stats[subcategory] ?? 0) + increment;

    const legacyStatKey = legacyStatMap[subcategory];
    if (legacyStatKey) {
      stats[legacyStatKey] = (stats[legacyStatKey] ?? 0) + increment;
    }

    const progress = [...(profile.achievementProgress ?? [])];
    const unlocked: Array<{ key: string; title: string; rewardXp: number }> = [];

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
            rewardXp: Math.max(0, Math.floor(Number(definition.rewardXp ?? 0))),
            hidden: definition.hidden ?? false,
          };

      if (existing.completedAt) {
        // One-time objective: once completed, keep it completed and skip re-activation logic.
        if (index >= 0) {
          progress[index] = {
            ...existing,
            title: definition.title,
            subcategory: definition.subcategory,
            target: definition.targetCount,
            rewardXp: Math.max(0, Math.floor(Number(definition.rewardXp ?? 0))),
            hidden: definition.hidden ?? false,
          };
        }
        continue;
      }

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
        rewardXp: Math.max(0, Math.floor(Number(definition.rewardXp ?? 0))),
        updatedAt: new Date(),
        ...(completedAt ? { completedAt } : {}),
      };

      if (index >= 0) {
        progress[index] = updatedEntry;
      } else {
        progress.push(updatedEntry);
      }

      if (!completed && completedAt) {
        unlocked.push({
          key: definition.key,
          title: definition.title,
          rewardXp: Math.max(0, Math.floor(Number(definition.rewardXp ?? 0))),
        });
      }
    }

    const bonusXp = unlocked.reduce((total, entry) => total + entry.rewardXp, 0);

    const updates: Record<string, unknown> = {
      $set: {
        achievementStats: stats,
        achievementProgress: progress,
      },
      ...(bonusXp > 0 ? { $inc: { totalXp: bonusXp } } : {}),
    };

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    );

    const previousRank = profile.experienceLevel ?? ExperienceLevel.F;
    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );
    const newRank = syncedProfile.experienceLevel ?? previousRank;
    const nextRankProgress = await this.buildRankProgress(
      syncedProfile ?? updatedProfile ?? profile,
    );

    return {
      subcategory,
      increment,
      stats,
      unlocked,
      rankUnlocked: newRank !== previousRank,
      previousRank,
      newRank,
      nextRankProgress,
    };
  }

  private doesContextMatchRule(rule: ParsedXpRule, context: XpEventContext) {
    if (!rule.conditions) {
      return true;
    }

    if (
      rule.conditions.difficulty
      && this.normalizeDifficulty(String(context.difficulty ?? '')) !== rule.conditions.difficulty
    ) {
      return false;
    }

    if (
      rule.conditions.district
      && this.normalizeKey(String(context.district ?? '')) !== rule.conditions.district
    ) {
      return false;
    }

    if (
      rule.conditions.locationKey
      && this.resolveLocationKey(context) !== rule.conditions.locationKey
    ) {
      return false;
    }

    if (
      rule.conditions.activityType
      && this.normalizeKey(String(context.activityType ?? '')) !== rule.conditions.activityType
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

    if (rule.conditions.hiddenGem !== undefined && Boolean(context.hiddenGem) !== rule.conditions.hiddenGem) {
      return false;
    }

    if (rule.conditions.rareRoute !== undefined && Boolean(context.rareRoute) !== rule.conditions.rareRoute) {
      return false;
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
        return `${rule.code}:difficulty:${this.normalizeDifficulty(String(context.difficulty ?? ''))}`;
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
      return Boolean(this.normalizeDifficulty(String(context.difficulty ?? '')));
    }

    if (rule.repeat === 'once_per_referred_user') {
      return Boolean(String(context.referredUserId ?? '').trim());
    }

    return true;
  }

  private getRepeatCountForLocation(
    history: NonNullable<User['xpHistory']>,
    eventKey: string,
    context: XpEventContext,
  ) {
    const locationKey = this.resolveLocationKey(context);

    if (!locationKey) {
      return 0;
    }

    return history.filter((entry) => {
      const entryEvent = this.normalizeKey(String(entry.eventKey ?? ''));

      if (entryEvent !== this.normalizeKey(eventKey)) {
        return false;
      }

      const entryLocation = this.resolveLocationKey((entry.context ?? {}) as XpEventContext);
      return entryLocation === locationKey;
    }).length;
  }

  private hasVisitedDistrict(
    history: NonNullable<User['xpHistory']>,
    districtKey: string,
  ) {
    if (!districtKey) {
      return false;
    }

    return history.some((entry) => {
      const entryDistrict = this.resolveDistrictKey((entry.context ?? {}) as XpEventContext);
      return entryDistrict === districtKey;
    });
  }

  private hasVisitedLocation(
    history: NonNullable<User['xpHistory']>,
    locationKey: string,
  ) {
    if (!locationKey) {
      return false;
    }

    return history.some((entry) => {
      const entryLocation = this.resolveLocationKey((entry.context ?? {}) as XpEventContext);
      return entryLocation === locationKey;
    });
  }

  private evaluateXpBreakdown(
    rule: ParsedXpRule | null,
    eventKey: string,
    context: XpEventContext,
    history: NonNullable<User['xpHistory']>,
  ): XpBreakdown {
    const normalizedDifficulty = this.normalizeDifficulty(String(context.difficulty ?? ''));
    const fallbackBase = this.getSystemDifficultyBaseXp(normalizedDifficulty);
    const baseXp = rule
      ? rule.overrideEnabled && rule.overrideXp !== undefined
        ? Math.max(0, Math.floor(rule.overrideXp))
        : Math.max(0, Math.floor(rule.baseXp))
      : fallbackBase;

    const source: XpBreakdown['source'] = rule
      ? rule.overrideEnabled && rule.overrideXp !== undefined
        ? 'override'
        : 'rule'
      : 'fallback';

    const difficultyMultiplier = Math.max(
      0,
      Number(
        rule?.difficultyMultipliers?.[normalizedDifficulty as 'easy' | 'moderate' | 'hard' | 'extreme']
        ?? 1,
      ),
    );

    const difficultyComponent = Math.floor(baseXp * difficultyMultiplier);

    const locationKey = this.resolveLocationKey(context);
    const districtKey = this.resolveDistrictKey(context);
    const firstVisit = context.firstVisit !== undefined
      ? Boolean(context.firstVisit)
      : !this.hasVisitedLocation(history, locationKey);
    const newDistrict = context.newDistrict !== undefined
      ? Boolean(context.newDistrict)
      : !this.hasVisitedDistrict(history, districtKey);

    const explorationBonus =
      (firstVisit ? Math.max(0, Math.floor(rule?.explorationBonuses.firstVisit ?? 150)) : 0)
      + (newDistrict ? Math.max(0, Math.floor(rule?.explorationBonuses.newDistrict ?? 250)) : 0)
      + (Boolean(context.hiddenGem)
        ? Math.max(0, Math.floor(rule?.explorationBonuses.hiddenGem ?? 300))
        : 0)
      + (Boolean(context.rareRoute)
        ? Math.max(0, Math.floor(rule?.explorationBonuses.rareRoute ?? 400))
        : 0);

    const normalizedEventKey = this.normalizeKey(eventKey);
    const fallbackSocialBonus = normalizedEventKey === 'referral_completed_trek'
      ? 250
      : normalizedEventKey === 'host_campaign_completed'
        ? 180
        : normalizedEventKey === 'campaign_created'
          ? 120
          : 0;

    const socialBonus = Math.max(
      0,
      Math.floor(
        rule?.socialBonusXp
        ?? fallbackSocialBonus,
      ),
    ) + Math.max(0, Math.floor(rule?.bonusXp ?? 0));

    const beforePenalty = Math.max(0, difficultyComponent + explorationBonus + socialBonus);
    const repeatCountForLocation = this.getRepeatCountForLocation(history, eventKey, context);
    const repeatMultiplier = rule?.repeatPenaltyEnabled === false
      ? 1
      : this.getDefaultRepeatMultiplier(repeatCountForLocation);
    const finalXp = Math.max(0, Math.floor(beforePenalty * repeatMultiplier));
    const repeatPenalty = Math.max(0, beforePenalty - finalXp);

    return {
      baseXp,
      source,
      difficultyMultiplier,
      difficultyComponent,
      explorationBonus,
      socialBonus,
      repeatMultiplier,
      repeatPenalty,
      beforePenalty,
      finalXp,
      repeatCountForLocation,
    };
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
        const rawRankCode = parsed?.rankCode?.trim() || item.name?.trim();

        if (!parsed || !rawRankCode) {
          return null;
        }

        const rankCode = this.normalizeRankCode(rawRankCode) || rawRankCode;

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

  private getAchievementStats(profile: RankProgressProfile) {
    const completedAchievements = (profile.achievementProgress ?? []).filter(
      (entry) => Boolean(entry.completedAt),
    ).length;

    const dynamicStats = Object.fromEntries(
      Object.entries((profile.achievementStats ?? {}) as Record<string, unknown>)
        .map(([key, value]): [string, number] => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value) && value >= 0)
        .map(([key, value]): [string, number] => [key, Math.floor(value)]),
    ) as Record<string, number>;

    return {
      ...dynamicStats,
      achievements: completedAchievements,
    };
  }

  private isLevelWithinRule(rule: LevelUpRule, level: number) {
    const safeLevel = Math.max(1, Math.floor(level));

    if (rule.minLevel !== undefined && safeLevel < Math.max(1, Math.floor(rule.minLevel))) {
      return false;
    }

    if (rule.maxLevel !== undefined && safeLevel > Math.max(1, Math.floor(rule.maxLevel))) {
      return false;
    }

    return true;
  }

  private meetsLevelUpRequirements(rule: LevelUpRule, profile: RankProgressProfile) {
    if (!rule.requirements) {
      return true;
    }

    const stats = this.getAchievementStats(profile);

    return Object.entries(rule.requirements).every(([rawKey, requiredValue]) => {
      const requirementKey = this.normalizeAchievementSubcategory(rawKey);
      const currentValue = Number(
        stats[requirementKey]
        ?? stats[rawKey]
        ?? 0,
      );

      return currentValue >= Math.max(0, Math.floor(requiredValue));
    });
  }

  private meetsRankGate(rule: LevelUpRule, currentRank: string) {
    if (!rule.requireRank) {
      return true;
    }

    return this.normalizeRankCode(rule.requireRank) === this.normalizeRankCode(currentRank);
  }

  private async buildNextRankProgress(profile: RankProgressProfile, rules?: LevelUpRule[]) {
    const rulesList = rules ?? await this.getLevelUpRules();
    const totalXp = this.getTotalXp(profile);
    const level = this.getLevelFromXp(totalXp);
    const effectiveCurrentRank = this.resolveRankByRulesOrFallback(profile, rulesList, level);
    const normalizedCurrentRank = this.normalizeRankCode(effectiveCurrentRank);
    const sortedRules = [...rulesList].sort((first, second) => first.requiredXp - second.requiredXp);
    const currentIndex = sortedRules.findIndex(
      (rule) => this.normalizeRankCode(rule.rankCode) === normalizedCurrentRank,
    );
    const currentRankRule = currentIndex >= 0
      ? sortedRules[currentIndex]
      : this.getCurrentRankRule(profile, sortedRules, totalXp, effectiveCurrentRank);
    const nextRule = currentIndex >= 0
      ? sortedRules[currentIndex + 1]
      : sortedRules.find((rule) => rule.requiredXp > totalXp);

    if (!nextRule) {
      return null;
    }

    const currentRankCode = this.normalizeRankCode(effectiveCurrentRank)
      || this.normalizeRankCode(String(currentRankRule?.rankCode ?? sortedRules[0]?.rankCode ?? ExperienceLevel.F))
      || ExperienceLevel.F;
    const currentRankRequiredXp = Math.max(0, Math.floor(currentRankRule?.requiredXp ?? 0));
    const currentRankXp = Math.max(0, totalXp - currentRankRequiredXp);
    const rankBandSize = Math.max(1, nextRule.requiredXp - currentRankRequiredXp);
    const progressPercentage = Math.max(0, Math.min(100, Math.round((currentRankXp / rankBandSize) * 100)));
    const remainingXp = Math.max(0, nextRule.requiredXp - totalXp);
    const stats = this.getAchievementStats(profile);
    const requirements = nextRule.requirements ?? {};
    const remainingRequirements = Object.fromEntries(
      Object.entries(requirements).map(([rawKey, rawRequiredValue]) => {
        const requirementKey = this.normalizeAchievementSubcategory(rawKey);
        const requiredValue = Math.max(0, Math.floor(Number(rawRequiredValue) || 0));
        const currentValue = Math.max(
          0,
          Math.floor(Number(stats[requirementKey] ?? stats[rawKey] ?? 0)),
        );

        return [requirementKey, Math.max(0, requiredValue - currentValue)];
      }),
    ) as Record<string, number>;

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
      currentXp: totalXp,
      currentRankRequiredXp,
      currentRankXp,
      xpToNextRank: remainingXp,
      progressPercentage,
      remainingXp,
      requiredAchievements: requirements,
      remainingAchievements: remainingRequirements,
      nextRankHidden: false,
    };
  }

  private async buildRankProgress(profile: RankProgressProfile, rules?: LevelUpRule[]) {
    return this.buildNextRankProgress(profile, rules);
  }

  private getXpThresholdForLevel(level: number) {
    const safeLevel = Math.max(1, Math.floor(level));

    if (safeLevel <= 1) {
      return 0;
    }

    let requiredXp = 0;

    for (let step = 2; step <= safeLevel; step += 1) {
      requiredXp += 80 + (step - 2) * 35;
    }

    return requiredXp;
  }

  private getLevelFromXp(xp: number) {
    const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
    let level = 1;

    for (let nextLevel = 2; nextLevel <= 100; nextLevel += 1) {
      if (safeXp >= this.getXpThresholdForLevel(nextLevel)) {
        level = nextLevel;
      } else {
        break;
      }
    }

    return level;
  }

  private getFallbackRankForLevel(level: number) {
    if (level >= 91) {
      return 'Heroic';
    }

    if (level >= 81) {
      return 'Mythic';
    }

    if (level >= 71) {
      return 'SSS';
    }

    if (level >= 61) {
      return 'SS';
    }

    if (level >= 51) {
      return 'S';
    }

    if (level >= 41) {
      return 'A';
    }

    if (level >= 31) {
      return 'B';
    }

    if (level >= 21) {
      return 'C';
    }

    if (level >= 11) {
      return 'D';
    }

    if (level >= 2) {
      return ExperienceLevel.E;
    }

    return ExperienceLevel.F;
  }

  private resolveRankByRulesOrFallback(
    profile: RankProgressProfile,
    rules: LevelUpRule[],
    level: number,
  ) {
    void profile;
    void rules;
    // Current rank always follows fallback level bands.
    // Rule requirements are used for next-rank eligibility/progress, not for current rank assignment.
    return this.getFallbackRankForLevel(level);
  }

  private resolveProgressionSnapshot(
    profile: RankProgressProfile,
    rules: LevelUpRule[],
  ) {
    const totalXp = this.getTotalXp(profile);
    const level = this.getLevelFromXp(totalXp);
    const experienceLevel = this.resolveRankByRulesOrFallback(profile, rules, level);
    const currentRankRule = this.getCurrentRankRule(profile, rules, totalXp, experienceLevel);
    const currentRankRequiredXp = Math.max(0, Math.floor(currentRankRule?.requiredXp ?? 0));
    const xp = Math.max(0, totalXp - currentRankRequiredXp);

    return {
      totalXp,
      xp,
      level,
      experienceLevel,
    };
  }

  private async applyLevelProgression(profile: User, rules?: LevelUpRule[]) {
    const levelUpRules = rules ?? await this.getLevelUpRules();
    const snapshot = this.resolveProgressionSnapshot(profile, levelUpRules);

    const currentLevel = profile.level ?? 1;
    const currentRank = this.normalizeRankCode(String(profile.experienceLevel ?? ''));
    const normalizedCurrentRank = this.normalizeRankCode(currentRank);
    const normalizedNextRank = this.normalizeRankCode(snapshot.experienceLevel);
    const levelDiffers = currentLevel !== snapshot.level;
    const rankDiffers = normalizedCurrentRank !== normalizedNextRank;
    const xpDiffers = Math.max(0, Math.floor(Number(profile.xp ?? 0))) !== snapshot.xp;

    const shouldUpdate = levelDiffers || rankDiffers || xpDiffers;

    if (!shouldUpdate) {
      this.logger.debug(`No update needed for profile ${profile._id}: level=${currentLevel}, rank=${currentRank}, xp=${profile.xp}`);
      return profile;
    }

    this.logger.log(`⚡ Updating profile ${profile._id}: level ${currentLevel}→${snapshot.level}, rank ${currentRank}→${snapshot.experienceLevel}, xp ${profile.xp}→${snapshot.xp}`);

    const updateData = {
      totalXp: snapshot.totalXp,
      xp: snapshot.xp,
      level: snapshot.level,
      experienceLevel: snapshot.experienceLevel,
    };

    this.logger.log(`  Update payload:`, updateData);

    const updated = await this.userModel.findByIdAndUpdate(
      profile._id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updated) {
      this.logger.error(`❌ Profile update FAILED (null returned) for ${profile._id}`);
      return profile;
    }

    this.logger.log(`✅ Profile updated: level=${updated.level}, rank=${updated.experienceLevel}, xp=${updated.xp}`);
    return updated;
  }

  private async evaluateXpForProfile(
    profile: User,
    eventKey: string,
    context: XpEventContext = {},
    options?: {
      simulateOnly?: boolean;
    },
  ) {
    const normalizedEventKey = this.normalizeKey(eventKey);

    if (!normalizedEventKey) {
      throw new BadRequestException('eventKey is required');
    }

    const rules = await this.getEnabledXpRules();
    const matchingRules = rules.filter((rule) => rule.eventKey === normalizedEventKey);
    const existingHistory = profile.xpHistory ?? [];
    const updates: NonNullable<User['xpHistory']> = [];

    if (matchingRules.length === 0) {
      const fallbackBreakdown = this.evaluateXpBreakdown(
        null,
        normalizedEventKey,
        context,
        existingHistory,
      );

      const fallbackUpdate = {
        eventKey: normalizedEventKey,
        ruleCode: 'SYS-FALLBACK',
        ruleName: 'System fallback XP',
        points: fallbackBreakdown.finalXp,
        contextKey: `SYS-FALLBACK:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        context: {
          ...context,
          xpBreakdown: fallbackBreakdown,
        },
        awardedAt: new Date(),
      };

      const shouldLog = options?.simulateOnly !== true || fallbackBreakdown.finalXp > 0;
      const totalAwarded = fallbackBreakdown.finalXp;
      const previousRank = profile.experienceLevel ?? 'F';
      let syncedProfile = profile;
      let updatedProfile: User | null | undefined = undefined;

      if (!options?.simulateOnly && shouldLog) {
        updatedProfile = await this.userModel.findByIdAndUpdate(
          profile._id,
          {
            ...(totalAwarded > 0 ? { $inc: { totalXp: totalAwarded } } : {}),
            $push: { xpHistory: { $each: [fallbackUpdate] } },
          },
          {
            new: true,
            runValidators: true,
          },
        );

        syncedProfile = await this.applyLevelProgression(updatedProfile ?? profile);
      }

      const levelUpRules = await this.getLevelUpRules();
      const newRank = (options?.simulateOnly ? previousRank : syncedProfile.experienceLevel) ?? previousRank;
      const rankProgressTarget = options?.simulateOnly ? profile : syncedProfile;
      const nextRankProgress = await this.buildRankProgress(rankProgressTarget, levelUpRules);

      return {
        eventKey: normalizedEventKey,
        totalAwarded,
        currentXp: options?.simulateOnly
          ? this.getTotalXp(profile) + totalAwarded
          : this.getTotalXp(syncedProfile ?? updatedProfile ?? profile),
        appliedRules: [
          {
            ruleCode: fallbackUpdate.ruleCode,
            ruleName: fallbackUpdate.ruleName,
            points: fallbackUpdate.points,
            breakdown: fallbackBreakdown,
          },
        ],
        rankUnlocked: newRank !== previousRank,
        previousRank,
        newRank,
        nextRankProgress,
        fallbackApplied: true,
      };
    }

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

      const breakdown = this.evaluateXpBreakdown(
        rule,
        normalizedEventKey,
        context,
        existingHistory,
      );

      updates.push({
        eventKey: normalizedEventKey,
        ruleCode: rule.code,
        ruleName: rule.name,
        points: breakdown.finalXp,
        contextKey,
        context: {
          ...context,
          xpBreakdown: breakdown,
        },
        awardedAt: new Date(),
      });
    }

    if (updates.length === 0) {
      return {
        eventKey: normalizedEventKey,
        totalAwarded: 0,
        appliedRules: [],
        fallbackApplied: false,
      };
    }

    const totalAwarded = updates.reduce((total, entry) => total + Math.max(0, entry.points), 0);
    const previousRank = profile.experienceLevel ?? 'F';

    if (options?.simulateOnly) {
      return {
        eventKey: normalizedEventKey,
        totalAwarded,
        currentXp: this.getTotalXp(profile) + totalAwarded,
        appliedRules: updates.map((entry) => ({
          ruleCode: entry.ruleCode,
          ruleName: entry.ruleName,
          points: entry.points,
          breakdown: (entry.context?.xpBreakdown ?? null) as XpBreakdown | null,
        })),
        rankUnlocked: false,
        previousRank,
        newRank: previousRank,
        nextRankProgress: await this.buildRankProgress(profile),
        fallbackApplied: false,
      };
    }

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        ...(totalAwarded > 0 ? { $inc: { totalXp: totalAwarded } } : {}),
        $push: { xpHistory: { $each: updates } },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const syncedProfile = await this.applyLevelProgression(updatedProfile ?? profile);
    const levelUpRules = await this.getLevelUpRules();
    const newRank = syncedProfile?.experienceLevel ?? previousRank;
    const nextRankProgress = await this.buildRankProgress(
      syncedProfile ?? updatedProfile ?? profile,
      levelUpRules,
    );

    return {
      eventKey: normalizedEventKey,
      totalAwarded,
      currentXp: this.getTotalXp(syncedProfile ?? updatedProfile ?? profile),
      appliedRules: updates.map((entry) => ({
        ruleCode: entry.ruleCode,
        ruleName: entry.ruleName,
        points: entry.points,
        breakdown: (entry.context?.xpBreakdown ?? null) as XpBreakdown | null,
      })),
      rankUnlocked: newRank !== previousRank,
      previousRank,
      newRank,
      nextRankProgress,
      fallbackApplied: false,
    };
  }

  async awardXpForEvent(
    authId: string,
    eventKey: string,
    context: XpEventContext = {},
  ) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    const xpResult = await this.evaluateXpForProfile(profile, eventKey, context);
    const rankUnlocked =
      'rankUnlocked' in xpResult && xpResult.rankUnlocked === true;
    const newRank =
      'newRank' in xpResult && typeof xpResult.newRank === 'string'
        ? xpResult.newRank
        : undefined;
    const autoAchievement = await this.recordAutomaticAchievementEvents(
      authId,
      eventKey,
      context,
      {
        rankUnlocked,
        newRank,
      },
    );

    return {
      ...xpResult,
      autoAchievement,
    };
  }

  async simulateXpForProfileEvent(
    profileId: string,
    eventKey: string,
    context: XpEventContext = {},
  ) {
    const profile = await this.userModel.findById(profileId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.evaluateXpForProfile(profile, eventKey, context, {
      simulateOnly: true,
    });
  }

  async simulateXpEvent(
    eventKey: string,
    context: XpEventContext = {},
    profileId?: string,
  ) {
    if (profileId?.trim()) {
      return this.simulateXpForProfileEvent(profileId.trim(), eventKey, context);
    }

    const simulatedProfile = {
      xp: 0,
      level: 1,
      experienceLevel: 'F',
      xpHistory: [],
      achievementStats: {
        hikes: 0,
        treks: 0,
        temples: 0,
        routes: 0,
        uniqueLocations: 0,
        difficultRoutes: 0,
        legendaryRoutes: 0,
        questChains: 0,
      },
    } as unknown as User;

    return this.evaluateXpForProfile(simulatedProfile, eventKey, context, {
      simulateOnly: true,
    });
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
      currentXp: this.getTotalXp(profile),
    };
  }

  async adminUpdateXpHistoryEntry(
    profileId: string,
    historyId: string,
    payload: {
      points: number;
      reason: string;
    },
    adminId: string,
  ) {
    const profile = await this.userModel.findById(profileId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const newPoints = Math.max(0, Math.floor(Number(payload.points)));

    if (!Number.isFinite(newPoints)) {
      throw new BadRequestException('points must be a valid non-negative number');
    }

    if (!String(payload.reason ?? '').trim()) {
      throw new BadRequestException('reason is required for XP history updates');
    }

    const history = [...(profile.xpHistory ?? [])];
    const index = history.findIndex((entry) => {
      const entryId = String((entry as unknown as { _id?: unknown })._id ?? '').trim();
      return entryId === historyId;
    });

    if (index === -1) {
      throw new NotFoundException('XP history entry not found');
    }

    const existing = history[index];
    const oldPoints = Math.max(0, Math.floor(Number(existing.points ?? 0)));
    const delta = newPoints - oldPoints;

    history[index] = {
      ...existing,
      points: newPoints,
      context: {
        ...(existing.context ?? {}),
        adminAdjustment: {
          adjustedAt: new Date(),
          adjustedBy: adminId,
          oldPoints,
          newPoints,
          reason: payload.reason.trim(),
        },
      },
    };

    const nextTotalXp = Math.max(0, Math.floor(Number(this.getTotalXp(profile)) + delta));

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        totalXp: nextTotalXp,
        xpHistory: history,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const syncedProfile = await this.applyLevelProgression(updatedProfile ?? profile);
    const levelUpRules = await this.getLevelUpRules();

    return {
      message: 'XP history entry updated successfully',
      historyId,
      oldPoints,
      newPoints,
      delta,
      reason: payload.reason.trim(),
      currentXp: this.getTotalXp(syncedProfile ?? updatedProfile ?? profile),
      level: syncedProfile.level,
      rank: syncedProfile.experienceLevel,
      nextRankProgress: await this.buildRankProgress(syncedProfile, levelUpRules),
    };
  }

  async adminDeleteXpHistoryEntry(
    profileId: string,
    historyId: string,
    adminId: string,
    reason: string,
  ) {
    const profile = await this.userModel.findById(profileId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const history = [...(profile.xpHistory ?? [])];
    const index = history.findIndex((entry) => {
      const entryId = String((entry as unknown as { _id?: unknown })._id ?? '').trim();
      return entryId === historyId;
    });

    if (index === -1) {
      throw new NotFoundException('XP history entry not found');
    }

    if (!String(reason ?? '').trim()) {
      throw new BadRequestException('reason is required for XP history deletion');
    }

    const existing = history[index];
    const deletedPoints = Math.max(0, Math.floor(Number(existing.points ?? 0)));
    history.splice(index, 1);

    const nextTotalXp = Math.max(0, Math.floor(Number(this.getTotalXp(profile)) - deletedPoints));

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        totalXp: nextTotalXp,
        xpHistory: history,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const syncedProfile = await this.applyLevelProgression(updatedProfile ?? profile);
    const levelUpRules = await this.getLevelUpRules();

    return {
      message: 'XP history entry deleted successfully',
      historyId,
      deletedPoints,
      deletedBy: adminId,
      reason: reason.trim(),
      currentXp: this.getTotalXp(syncedProfile ?? updatedProfile ?? profile),
      level: syncedProfile.level,
      rank: syncedProfile.experienceLevel,
      nextRankProgress: await this.buildRankProgress(syncedProfile, levelUpRules),
    };
  }

  async adminAddXpToUser(
    profileId: string,
    xpToAdd: number,
    adminId: string,
    reason: string,
  ) {
    let profile = await this.userModel.findById(profileId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Validate input
    const safeXp = Math.max(1, Math.min(500, Math.floor(Number(xpToAdd))));

    if (!Number.isFinite(safeXp) || safeXp < 1 || safeXp > 500) {
      throw new BadRequestException('XP to add must be between 1 and 500');
    }

    if (!String(reason ?? '').trim()) {
      throw new BadRequestException('Reason is required for XP additions');
    }

    try {
      this.logger.log(`🎯 Adding ${safeXp} XP to user ${profileId} (current totalXp: ${profile.totalXp})`);

      // Store previous state
      const previousXp = Math.max(0, Math.floor(Number(profile.xp ?? 0)));
      const previousTotalXp = this.getTotalXp(profile);
      const previousLevel = profile.level ?? 1;
      const previousRank = profile.experienceLevel ?? 'F';

      this.logger.log(`  Before: level=${previousLevel}, rank=${previousRank}, totalXp=${previousTotalXp}, currentXp=${previousXp}`);

      // Create XP history entry
      const newHistoryEntry = {
        eventKey: 'admin.add_xp',
        ruleCode: 'admin_add_xp',
        ruleName: 'Admin XP Addition',
        points: safeXp,
        contextKey: `admin_xp_${Date.now()}`,
        context: {
          adminId,
          reason: reason.trim(),
          previousTotalXp,
        },
        awardedAt: new Date(),
      };

      // Update profile with new XP
      const nextTotalXp = previousTotalXp + safeXp;
      const history = [...(profile.xpHistory ?? []), newHistoryEntry];

      this.logger.log(`  Updating totalXp: ${previousTotalXp} → ${nextTotalXp}`);

      let updatedProfile = await this.userModel.findByIdAndUpdate(
        profile._id,
        {
          totalXp: nextTotalXp,
          xpHistory: history,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedProfile) {
        throw new NotFoundException('Failed to update profile');
      }

      this.logger.log(`  ✅ XP updated in DB: totalXp now = ${updatedProfile.totalXp}`);
      this.logger.log(`  Now applying level progression...`);

      // Apply level progression (this automatically updates level and rank based on new totalXp)
      await this.applyLevelProgression(updatedProfile);

      // Force refresh from DB to ensure we have the latest data
      const syncedProfile = await this.userModel.findById(profileId);
      if (!syncedProfile) {
        throw new NotFoundException('Profile lost after update');
      }

      this.logger.log(`  🔄 Refreshed from DB: level=${syncedProfile.level}, rank=${syncedProfile.experienceLevel}`);

      const levelUpRules = await this.getLevelUpRules();
      const newLevel = syncedProfile.level ?? previousLevel;
      const newRank = syncedProfile.experienceLevel ?? previousRank;
      const newXp = Math.max(0, Math.floor(Number(syncedProfile.xp ?? 0)));

      this.logger.log(`  After: level=${newLevel}, rank=${newRank}, totalXp=${syncedProfile.totalXp}, currentXp=${newXp}`);

      // Determine if rank actually changed
      const rankChanged = this.normalizeKey(previousRank) !== this.normalizeKey(newRank);
      const levelChanged = previousLevel !== newLevel;

      this.logger.log(`  Comparison: rankChanged=${rankChanged} (${previousRank}→${newRank}), levelChanged=${levelChanged} (${previousLevel}→${newLevel})`);

      const response = {
        message: `Added ${safeXp} XP to user`,
        previousXp,
        previousLevel,
        previousRank,
        newXp,
        newLevel,
        newRank,
        xpAdded: safeXp,
        autoRankedUp: rankChanged && levelChanged,
        autoRankUpReason: rankChanged ? `Rank automatically updated from ${previousRank} to ${newRank} due to level progression` : undefined,
        nextRankProgress: await this.buildRankProgress(syncedProfile, levelUpRules),
      };

      this.logger.log(`✅ XP addition complete`);
      return response;
    } catch (error) {
      this.logger.error(`Error adding XP to user ${profileId}:`, error);
      throw error;
    }
  }

  async validateAndApplyAutoRankUp(
    profileId: string,
    previousRank: string,
    currentRank: string,
    currentLevel: number,
  ) {
    const profile = await this.userModel.findById(profileId);

    if (!profile) {
      return {
        autoRankedUp: false,
        newRank: currentRank,
        newLevel: currentLevel,
        message: 'Profile not found for rank-up validation',
      };
    }

    // Don't auto-rank-up if rank didn't change from the level progression
    if (previousRank === currentRank) {
      return {
        autoRankedUp: false,
        newRank: currentRank,
        newLevel: currentLevel,
        message: 'Rank has not progressed',
      };
    }

    // Check if user has completed all rank-up achievements for the new rank
    // NOTE: This requires RankUpAchievementService to be injected
    // For now, we'll add a check but it will be integrated with the service
    try {
      // This will be populated once RankUpAchievementService is available
      const hasAllAchievements = true; // TODO: Call rankUpAchievementService.validateRankUp()

      if (!hasAllAchievements) {
        // Revert rank but keep level
        await this.userModel.findByIdAndUpdate(
          profile._id,
          {
            experienceLevel: previousRank,
          },
          { new: true },
        );

        return {
          autoRankedUp: false,
          newRank: previousRank,
          newLevel: currentLevel,
          message: 'Rank-up achievements not completed. User remains at previous rank.',
        };
      }

      // Auto-rank-up is approved - rank is already updated by applyLevelProgression
      return {
        autoRankedUp: true,
        newRank: currentRank,
        newLevel: currentLevel,
        message: `User automatically ranked up to ${currentRank} and completed all achievements`,
      };
    } catch {
      // If there's an error checking achievements, allow rank-up to proceed
      return {
        autoRankedUp: true,
        newRank: currentRank,
        newLevel: currentLevel,
        message: 'Auto rank-up applied (achievement validation unavailable)',
      };
    }
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
      totalXp: 0,
      level: 1,
      experienceLevel: ExperienceLevel.F,
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

    const levelUpRules = await this.getLevelUpRules();
    const syncedProfile = await this.applyLevelProgression(profile, levelUpRules);
    return this.attachAuthContactInfo(syncedProfile, levelUpRules);
  }

  async getPublicProfileById(profileId: string) {
    const profile = await this.userModel
      .findOne({
        _id: this.toObjectId(profileId),
        isProfilePublic: true,
        profileCompleted: true,
      })
      .select('-authId -xp -totalXp -badge -updatedAt -__v -profilePhotoPublicId');

    if (!profile) {
      throw new NotFoundException('Public profile not found');
    }

    return {
      ...profile.toObject(),
      level: profile.level ?? 1,
  experienceLevel: profile.experienceLevel ?? ExperienceLevel.F,
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

    const levelUpRules = await this.getLevelUpRules();
    const syncedProfile = await this.applyLevelProgression(updatedProfile, levelUpRules);
    return this.attachAuthContactInfo(syncedProfile, levelUpRules);
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
        .select('-authId -xp -totalXp -badge -updatedAt -__v -profilePhotoPublicId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.userModel.countDocuments(filter),
    ]);

    const levelUpRules = await this.getLevelUpRules();
    const syncedItems = await Promise.all(
      items.map(async (item) => {
        const syncedItem = await this.applyLevelProgression(item, levelUpRules);

        return {
          ...syncedItem.toObject(),
          nextRankProgress: await this.buildRankProgress(syncedItem, levelUpRules),
        };
      }),
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

  async getAllProfiles(pagination: {
    page: number;
    limit: number;
    q?: string;
    status?: 'all' | 'complete' | 'incomplete';
  }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = pagination.q?.trim();
    const status = pagination.status ?? 'all';
    const filter: Record<string, unknown> = {};

    if (status === 'complete') {
      filter.profileCompleted = true;
    } else if (status === 'incomplete') {
      filter.profileCompleted = false;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const queryRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { firstName: queryRegex },
        { lastName: queryRegex },
        { location: queryRegex },
        { province: queryRegex },
        { district: queryRegex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-xpHistory -receivedRatings -photoVerificationRequests -adminFlags -profilePhotoPublicId -__v')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.userModel.countDocuments(filter),
    ]);

    const levelUpRules = await this.getLevelUpRules();
    const syncedItems = await Promise.all(
      items.map(async (item) => {
        const snapshot = this.resolveProgressionSnapshot(item, levelUpRules);
        const syncedItem = {
          ...item.toObject(),
          totalXp: snapshot.totalXp,
          xp: snapshot.xp,
          level: snapshot.level,
          experienceLevel: snapshot.experienceLevel,
        };

        return {
          ...syncedItem,
          nextRankProgress: await this.buildRankProgress(syncedItem, levelUpRules),
        };
      }),
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

  async getPhotoVerificationQueue(pagination: {
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    page: number;
    limit: number;
  }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = pagination.status ?? 'pending';

    const pipeline: PipelineStage[] = [
      { $unwind: '$photoVerificationRequests' },
    ];

    if (status !== 'all') {
      pipeline.push({
        $match: {
          'photoVerificationRequests.status': status,
        },
      });
    }

    pipeline.push(
      { $sort: { 'photoVerificationRequests.submittedAt': -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                profileId: '$_id',
                firstName: 1,
                middleName: 1,
                lastName: 1,
                profilePhoto: 1,
                location: 1,
                province: 1,
                district: 1,
                level: 1,
                experienceLevel: 1,
                badge: 1,
                profileCompleted: 1,
                createdAt: 1,
                requestCode: '$photoVerificationRequests.requestCode',
                campaignId: '$photoVerificationRequests.campaignId',
                url: '$photoVerificationRequests.url',
                kind: '$photoVerificationRequests.kind',
                status: '$photoVerificationRequests.status',
                submittedAt: '$photoVerificationRequests.submittedAt',
                reviewedAt: '$photoVerificationRequests.reviewedAt',
                reviewedByAuthId: '$photoVerificationRequests.reviewedByAuthId',
                reviewNote: '$photoVerificationRequests.reviewNote',
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    );

    const [result] = await this.userModel.aggregate(pipeline);
    const items = (result?.items ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      profileId: String(item.profileId),
      reviewedByAuthId: item.reviewedByAuthId ? String(item.reviewedByAuthId) : undefined,
    }));

    const total = Number(result?.total?.[0]?.value ?? 0);

    return {
      items,
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

    const levelUpRules = await this.getLevelUpRules();
    const syncedProfile = await this.applyLevelProgression(profile);
    return this.attachAuthContactInfo(syncedProfile, levelUpRules);
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

    const levelUpRules = await this.getLevelUpRules();
    const syncedProfile = await this.applyLevelProgression(updatedProfile);
    return this.attachAuthContactInfo(syncedProfile, levelUpRules);
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

  private async attachAuthContactInfo(profile: User, rules?: LevelUpRule[]) {
    const levelUpRules = rules ?? await this.getLevelUpRules();
    const snapshot = this.resolveProgressionSnapshot(profile, levelUpRules);
    const auth = await this.authModel
      .findById(profile.authId)
      .select('phoneNumber email');
    const rankBadgeDefinitions = await this.getRankBadgeDefinitions();
    const unlockedRankBadges = this.getUnlockedRankBadges(
      snapshot.experienceLevel ?? ExperienceLevel.F,
      rankBadgeDefinitions,
    );
    const currentRankBadge = unlockedRankBadges.find((badge) => badge.isCurrentRank) ?? null;
    const nextRankProgress = await this.buildRankProgress(
      {
        experienceLevel: snapshot.experienceLevel,
        level: snapshot.level,
        xp: snapshot.xp,
        totalXp: snapshot.totalXp,
        achievementStats: profile.achievementStats,
        achievementProgress: profile.achievementProgress,
      },
      levelUpRules,
    );

    return {
      ...profile.toObject(),
      phoneNumber: auth?.phoneNumber ?? null,
      email: auth?.email ?? null,
      totalXp: snapshot.totalXp,
      xp: snapshot.xp,
      level: snapshot.level,
      experienceLevel: snapshot.experienceLevel ?? ExperienceLevel.F,
      rankBadges: unlockedRankBadges,
      currentRankBadge,
      subRank: (profile as User & { subRank?: string }).subRank ?? null,
      nextRankProgress,
    };
  }
}
