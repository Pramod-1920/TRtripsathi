import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { Auth } from '../auth/schemas/auth.schema';
import { ExperienceLevel } from '../auth/constants/experience-level.enum';
import { Role } from '../auth/constants/roles.enum';
import { CloudinaryService } from '../config/cloudinary/cloudinary.service';
import { BadgeService } from '../badge/badge.service';
import { ExtraCategory } from '../extra/constants/extra-category.enum';
import { ExtraItem } from '../extra/schemas/extra.schema';
import { Gender } from './constants/gender.enum';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './schemas/user.schema';
import { PlacesService } from '../extra/places.service';
import { VisitedPlaceService } from '../visited-place/visited-place.service';
import { XpLedgerService } from '../xp-ledger/xp-ledger.service';
import { haversineDistanceMeters } from '../common/geo.util';

const REMOVED_XP_EVENT_KEYS = new Set([
  'daily_streak',
  'daily-streak',
  'daily streak',
]);
const STANDALONE_PLACE_VERIFICATION_XP = 40;

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
  difficultyMultipliers?: Partial<
    Record<'easy' | 'moderate' | 'hard' | 'extreme', number>
  >;
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
  difficultyMultipliers: Partial<
    Record<'easy' | 'moderate' | 'hard' | 'extreme', number>
  >;
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
  | 'experienceLevel'
  | 'level'
  | 'xp'
  | 'totalXp'
  | 'achievementStats'
  | 'achievementProgress'
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
  private readonly rankOrder = [
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
    'S',
    'SS',
    'SSS',
    'Mythic',
    'Heroic',
  ] as const;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Auth.name) private readonly authModel: Model<Auth>,
    @InjectModel(ExtraItem.name) private readonly extraModel: Model<ExtraItem>,
    private readonly placesService: PlacesService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly visitedPlaceService: VisitedPlaceService,
    private readonly xpLedgerService: XpLedgerService,
    // BadgeService is imported via UserModule
    private readonly badgeService?: BadgeService,
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
    const sortedRules = [...rules].sort(
      (first, second) => first.requiredXp - second.requiredXp,
    );
    const normalizedRankCode = this.normalizeRankCode(
      String(rankCode ?? profile.experienceLevel ?? ''),
    );

    const exactRule = sortedRules.find(
      (rule) => this.normalizeRankCode(rule.rankCode) === normalizedRankCode,
    );

    if (exactRule) {
      return exactRule;
    }

    return (
      [...sortedRules]
        .filter((rule) => Math.max(0, Math.floor(rule.requiredXp)) <= totalXp)
        .pop() ?? sortedRules[0]
    );
  }

  private sanitizeProfileUpdates(updates: Record<string, unknown>) {
    const allowedKeys = [
      'firstName',
      'middleName',
      'lastName',
      'age',
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
      'travelerExperience',
      'travelStyle',
      'travelInterests',
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

    if (Object.prototype.hasOwnProperty.call(sanitized, 'travelInterests')) {
      if (!Array.isArray(sanitized.travelInterests)) {
        throw new BadRequestException('Travel interests must be an array');
      }

      sanitized.travelInterests = [
        ...new Set(
          sanitized.travelInterests
            .map((interest) => String(interest).trim().toLowerCase())
            .filter((interest) => interest.length > 0),
        ),
      ];
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'level')) {
      const rawLevel = Number(sanitized.level);

      if (!Number.isFinite(rawLevel) || rawLevel < 1) {
        throw new BadRequestException(
          'Level must be a number greater than or equal to 1',
        );
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
              .filter(
                ([key, value]) =>
                  key.length > 0 && Number.isFinite(value) && value > 0,
              )
              .map(([key, value]): [string, number] => [
                key,
                Math.floor(value),
              ]),
          )
        : undefined;

      const subRanks = Array.isArray(parsed.subRanks)
        ? parsed.subRanks
            .map((entry) => String(entry).trim())
            .filter((entry) => entry.length > 0)
        : typeof parsed.subRanks === 'string'
          ? String(parsed.subRanks)
              .split(',')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : undefined;

      return {
        ...(parsed.rankCode
          ? { rankCode: String(parsed.rankCode).trim() }
          : {}),
        requiredXp: Math.floor(requiredXp),
        ...(parsed.minLevel !== undefined
          ? { minLevel: Math.max(1, Math.floor(Number(parsed.minLevel))) }
          : {}),
        ...(parsed.maxLevel !== undefined
          ? { maxLevel: Math.max(1, Math.floor(Number(parsed.maxLevel))) }
          : {}),
        ...(subRanks ? { subRanks } : {}),
        ...(parsed.displayName
          ? { displayName: String(parsed.displayName).trim() }
          : {}),
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

    if (
      /\(\s*sss\s*\)/i.test(normalized) ||
      normalized.includes('nepal hike god')
    ) {
      return 'SSS';
    }

    if (
      /\(\s*ss\s*\)/i.test(normalized) ||
      normalized.includes('everest legend')
    ) {
      return 'SS';
    }

    if (
      /\(\s*s\s*\)/i.test(normalized) ||
      normalized.includes('peak sovereign')
    ) {
      return 'S';
    }

    if (
      /\(\s*a\s*\)/i.test(normalized) ||
      normalized.includes('himalayan elite')
    ) {
      return 'A';
    }

    if (
      /\(\s*b\s*\)/i.test(normalized) ||
      normalized.includes('summit conqueror')
    ) {
      return 'B';
    }

    if (
      /\(\s*c\s*\)/i.test(normalized) ||
      normalized.includes('ridge slayer')
    ) {
      return 'C';
    }

    if (
      /\(\s*d\s*\)/i.test(normalized) ||
      normalized.includes('trail hunter')
    ) {
      return 'D';
    }

    if (
      /\(\s*e\s*\)/i.test(normalized) ||
      normalized.includes('novice wanderer')
    ) {
      return 'E';
    }

    if (/\(\s*f\s*\)/i.test(normalized) || normalized.includes('starter')) {
      return 'F';
    }

    if (
      normalized.includes('heroic') ||
      normalized.includes('himalayan hero')
    ) {
      return 'Heroic';
    }

    if (
      normalized.includes('himalayan deity') ||
      normalized.includes('nepal conqueror')
    ) {
      return 'Mythic';
    }

    return '';
  }

  private parseRankBadgeValue(
    value?: string | null,
  ): RankBadgeRuleValue | null {
    if (!value?.trim()) {
      return null;
    }

    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed) as Partial<RankBadgeRuleValue>;
      return {
        ...(parsed.imageUrl?.trim()
          ? { imageUrl: parsed.imageUrl.trim() }
          : {}),
        ...(parsed.iconUrl?.trim() ? { iconUrl: parsed.iconUrl.trim() } : {}),
        ...(parsed.url?.trim() ? { url: parsed.url.trim() } : {}),
        ...(parsed.publicId?.trim()
          ? { publicId: parsed.publicId.trim() }
          : {}),
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

    // Rank assignment is built in, so its reward must not depend on an admin
    // uploading artwork first. Empty image URLs intentionally use the mobile
    // rank-letter fallback; configured badge artwork replaces these entries.
    const byRank = new Map<string, RankBadgeDefinition>(
      this.rankOrder.map((rankCode) => [
        rankCode,
        {
          rankCode,
          imageUrl: '',
          name: `Rank ${rankCode}`,
        },
      ]),
    );

    for (const item of items) {
      const rankCode = this.normalizeRankCode(item.name?.trim());
      const parsedValue = this.parseRankBadgeValue(item.value);
      const imageUrl =
        parsedValue?.imageUrl ?? parsedValue?.iconUrl ?? parsedValue?.url;

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
      (first, second) =>
        this.getRankOrderIndex(first.rankCode) -
        this.getRankOrderIndex(second.rankCode),
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
      .sort(
        (first, second) =>
          this.getRankOrderIndex(second.rankCode) -
          this.getRankOrderIndex(first.rankCode),
      )
      .map((definition) => ({
        ...definition,
        unlocked: true as const,
        isCurrentRank:
          this.normalizeRankCode(definition.rankCode) ===
          this.normalizeRankCode(currentRankCode),
      }));
  }

  private async ensureRankBadgesAwarded(
    profileId: string,
    currentRankCode: string,
    definitions?: RankBadgeDefinition[],
  ): Promise<void> {
    if (!this.badgeService) {
      return;
    }

    try {
      const rankBadgeDefinitions =
        definitions ?? (await this.getRankBadgeDefinitions());
      const unlockedRankBadges = this.getUnlockedRankBadges(
        currentRankCode,
        rankBadgeDefinitions,
      );

      for (const badge of unlockedRankBadges) {
        await this.badgeService.awardBadge(
          profileId,
          badge.rankCode,
          'rank',
          badge.name ?? `Rank ${badge.rankCode}`,
          `Unlocked by reaching Rank ${badge.rankCode}`,
          badge.imageUrl,
        );
      }
    } catch (error: unknown) {
      // XP progression must remain successful if badge persistence is
      // temporarily unavailable. A later profile fetch will backfill it.
      this.logger.warn(
        `Unable to synchronize rank badges for profile ${profileId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
    const explicit = this.normalizeKey(
      String(context.locationKey ?? context.placeName ?? ''),
    );

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

      if (REMOVED_XP_EVENT_KEYS.has(eventKey)) {
        return null;
      }

      const baseXp = Number(parsed.baseXp ?? parsed.points ?? 0);

      const overrideXp =
        parsed.overrideXp !== undefined ? Number(parsed.overrideXp) : undefined;

      const bonusXp = parsed.bonusXp !== undefined ? Number(parsed.bonusXp) : 0;

      const socialBonusXp =
        parsed.socialBonusXp !== undefined ? Number(parsed.socialBonusXp) : 0;

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

      if (!allowedRepeats.includes(repeat)) {
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

      if (
        Object.values(difficultyMultipliers).some(
          (value) => !Number.isFinite(value),
        )
      ) {
        return null;
      }

      const explorationBonuses = {
        firstVisit: Number(parsed.explorationBonuses?.firstVisit ?? 150),
        newDistrict: Number(parsed.explorationBonuses?.newDistrict ?? 250),
        hiddenGem: Number(parsed.explorationBonuses?.hiddenGem ?? 300),
        rareRoute: Number(parsed.explorationBonuses?.rareRoute ?? 400),
      };

      if (
        Object.values(explorationBonuses).some(
          (bonus) => !Number.isFinite(bonus),
        )
      ) {
        return null;
      }

      const conditions = parsed.conditions
        ? {
            ...(parsed.conditions.difficulty
              ? {
                  difficulty: this.normalizeDifficulty(
                    String(parsed.conditions.difficulty),
                  ),
                }
              : {}),
            ...(parsed.conditions.district
              ? {
                  district: this.normalizeKey(
                    String(parsed.conditions.district),
                  ),
                }
              : {}),
            ...(parsed.conditions.locationKey
              ? {
                  locationKey: this.normalizeKey(
                    String(parsed.conditions.locationKey),
                  ),
                }
              : {}),
            ...(parsed.conditions.activityType
              ? {
                  activityType: this.normalizeKey(
                    String(parsed.conditions.activityType),
                  ),
                }
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

      if (
        conditions?.ratingGte !== undefined &&
        !Number.isFinite(conditions.ratingGte)
      ) {
        return null;
      }

      return {
        eventKey,
        points: Math.floor(baseXp),
        baseXp: Math.floor(baseXp),
        ...(overrideXp !== undefined &&
        Number.isFinite(overrideXp) &&
        overrideXp >= 0
          ? { overrideXp: Math.floor(overrideXp) }
          : {}),
        ...(Number.isFinite(bonusXp)
          ? { bonusXp: Math.floor(Math.max(0, bonusXp)) }
          : {}),
        ...(Number.isFinite(socialBonusXp)
          ? { socialBonusXp: Math.floor(Math.max(0, socialBonusXp)) }
          : {}),
        ...(parsed.ruleType ? { ruleType: parsed.ruleType } : {}),
        ...(parsed.activityType
          ? { activityType: this.normalizeKey(parsed.activityType) }
          : {}),
        ...(parsed.locationKey
          ? { locationKey: this.normalizeKey(parsed.locationKey) }
          : {}),
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
        repeat: repeat,
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
          ...(parsed.overrideXp !== undefined
            ? { overrideXp: parsed.overrideXp }
            : {}),
          bonusXp: Math.floor(parsed.bonusXp ?? 0),
          socialBonusXp: Math.floor(parsed.socialBonusXp ?? 0),
          ruleType: parsed.ruleType ?? 'global',
          ...(parsed.activityType ? { activityType: parsed.activityType } : {}),
          ...(parsed.locationKey ? { locationKey: parsed.locationKey } : {}),
          overrideEnabled: parsed.overrideEnabled ?? false,
          repeatPenaltyEnabled: parsed.repeatPenaltyEnabled ?? true,
          difficultyMultipliers: parsed.difficultyMultipliers ?? {},
          explorationBonuses: {
            firstVisit: Math.floor(
              parsed.explorationBonuses?.firstVisit ?? 150,
            ),
            newDistrict: Math.floor(
              parsed.explorationBonuses?.newDistrict ?? 250,
            ),
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
        !parsed.key ||
        !parsed.subcategory ||
        parsed.targetCount === undefined ||
        parsed.rewardXp === undefined
      ) {
        return null;
      }

      const targetCount = Number(parsed.targetCount);
      const rewardXp = Number(parsed.rewardXp);

      if (
        !Number.isFinite(targetCount) ||
        targetCount < 1 ||
        !Number.isFinite(rewardXp) ||
        rewardXp < 1
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
    const subcategory = this.normalizeAchievementSubcategory(
      payload.subcategory,
    );
    const definitions = await this.getAchievementDefinitions();
    const filtered = definitions.filter((definition) => {
      if (payload.key?.trim()) {
        return (
          definition.key.toLowerCase() === payload.key.trim().toLowerCase() &&
          this.normalizeAchievementSubcategory(definition.subcategory) ===
            subcategory
        );
      }

      return (
        this.normalizeAchievementSubcategory(definition.subcategory) ===
        subcategory
      );
    });

    const stats = Object.fromEntries(
      Object.entries(
        (profile.achievementStats ?? {}) as Record<string, unknown>,
      )
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
    const unlocked: Array<{ key: string; title: string; rewardXp: number }> =
      [];

    for (const definition of filtered) {
      const index = progress.findIndex(
        (entry) => entry.key.toLowerCase() === definition.key.toLowerCase(),
      );

      const existing =
        index >= 0
          ? progress[index]
          : {
              key: definition.key,
              title: definition.title,
              subcategory: definition.subcategory,
              count: 0,
              target: definition.targetCount,
              rewardXp: Math.max(
                0,
                Math.floor(Number(definition.rewardXp ?? 0)),
              ),
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

    const bonusXp = unlocked.reduce(
      (total, entry) => total + entry.rewardXp,
      0,
    );

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
      rule.conditions.difficulty &&
      this.normalizeDifficulty(String(context.difficulty ?? '')) !==
        rule.conditions.difficulty
    ) {
      return false;
    }

    if (
      rule.conditions.district &&
      this.normalizeKey(String(context.district ?? '')) !==
        rule.conditions.district
    ) {
      return false;
    }

    if (
      rule.conditions.locationKey &&
      this.resolveLocationKey(context) !== rule.conditions.locationKey
    ) {
      return false;
    }

    if (
      rule.conditions.activityType &&
      this.normalizeKey(String(context.activityType ?? '')) !==
        rule.conditions.activityType
    ) {
      return false;
    }

    if (
      rule.conditions.solo !== undefined &&
      Boolean(context.solo) !== rule.conditions.solo
    ) {
      return false;
    }

    if (
      rule.conditions.hostOnly !== undefined &&
      Boolean(context.hostOnly) !== rule.conditions.hostOnly
    ) {
      return false;
    }

    if (rule.conditions.ratingGte !== undefined) {
      const rating = Number(context.rating ?? Number.NaN);

      if (!Number.isFinite(rating) || rating < rule.conditions.ratingGte) {
        return false;
      }
    }

    if (
      rule.conditions.hiddenGem !== undefined &&
      Boolean(context.hiddenGem) !== rule.conditions.hiddenGem
    ) {
      return false;
    }

    if (
      rule.conditions.rareRoute !== undefined &&
      Boolean(context.rareRoute) !== rule.conditions.rareRoute
    ) {
      return false;
    }

    return true;
  }

  private buildXpContextKey(rule: ParsedXpRule, context: XpEventContext) {
    switch (rule.repeat) {
      case 'once_per_user':
        return `${rule.code}:once_per_user`;
      case 'once_per_campaign':
        return `${rule.code}:campaign:${String(context.campaignId ?? '')
          .trim()
          .toLowerCase()}`;
      case 'once_per_district':
        return `${rule.code}:district:${this.normalizeKey(String(context.district ?? ''))}`;
      case 'once_per_difficulty':
        return `${rule.code}:difficulty:${this.normalizeDifficulty(String(context.difficulty ?? ''))}`;
      case 'once_per_referred_user':
        return `${rule.code}:ref:${String(context.referredUserId ?? '')
          .trim()
          .toLowerCase()}`;
      case 'always':
      default:
        return `${rule.code}:always:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  private hasSufficientRepeatContext(
    rule: ParsedXpRule,
    context: XpEventContext,
  ) {
    if (rule.repeat === 'once_per_campaign') {
      return Boolean(String(context.campaignId ?? '').trim());
    }

    if (rule.repeat === 'once_per_district') {
      return Boolean(this.normalizeKey(String(context.district ?? '')));
    }

    if (rule.repeat === 'once_per_difficulty') {
      return Boolean(
        this.normalizeDifficulty(String(context.difficulty ?? '')),
      );
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

      const entryLocation = this.resolveLocationKey(
        (entry.context ?? {}) as XpEventContext,
      );
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
      const entryDistrict = this.resolveDistrictKey(
        (entry.context ?? {}) as XpEventContext,
      );
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
      const entryLocation = this.resolveLocationKey(
        (entry.context ?? {}) as XpEventContext,
      );
      return entryLocation === locationKey;
    });
  }

  private evaluateXpBreakdown(
    rule: ParsedXpRule | null,
    eventKey: string,
    context: XpEventContext,
    history: NonNullable<User['xpHistory']>,
  ): XpBreakdown {
    const normalizedDifficulty = this.normalizeDifficulty(
      String(context.difficulty ?? ''),
    );
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
        rule?.difficultyMultipliers?.[
          normalizedDifficulty as 'easy' | 'moderate' | 'hard' | 'extreme'
        ] ?? 1,
      ),
    );

    const difficultyComponent = Math.floor(baseXp * difficultyMultiplier);

    const locationKey = this.resolveLocationKey(context);
    const districtKey = this.resolveDistrictKey(context);
    const firstVisit =
      Boolean(locationKey) &&
      (context.firstVisit !== undefined
        ? Boolean(context.firstVisit)
        : !this.hasVisitedLocation(history, locationKey));
    const newDistrict =
      Boolean(districtKey) &&
      (context.newDistrict !== undefined
        ? Boolean(context.newDistrict)
        : !this.hasVisitedDistrict(history, districtKey));

    const explorationBonus =
      (firstVisit
        ? Math.max(0, Math.floor(rule?.explorationBonuses.firstVisit ?? 150))
        : 0) +
      (newDistrict
        ? Math.max(0, Math.floor(rule?.explorationBonuses.newDistrict ?? 250))
        : 0) +
      (context.hiddenGem
        ? Math.max(0, Math.floor(rule?.explorationBonuses.hiddenGem ?? 300))
        : 0) +
      (context.rareRoute
        ? Math.max(0, Math.floor(rule?.explorationBonuses.rareRoute ?? 400))
        : 0);

    const normalizedEventKey = this.normalizeKey(eventKey);
    const fallbackSocialBonus =
      normalizedEventKey === 'referral_completed_trek'
        ? 250
        : normalizedEventKey === 'host_campaign_completed'
          ? 180
          : normalizedEventKey === 'campaign_created'
            ? 120
            : 0;

    const socialBonus =
      Math.max(0, Math.floor(rule?.socialBonusXp ?? fallbackSocialBonus)) +
      Math.max(0, Math.floor(rule?.bonusXp ?? 0));

    const beforePenalty = Math.max(
      0,
      difficultyComponent + explorationBonus + socialBonus,
    );
    const repeatCountForLocation = this.getRepeatCountForLocation(
      history,
      eventKey,
      context,
    );
    const repeatMultiplier =
      rule?.repeatPenaltyEnabled === false
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
      Object.entries(
        (profile.achievementStats ?? {}) as Record<string, unknown>,
      )
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

    if (
      rule.minLevel !== undefined &&
      safeLevel < Math.max(1, Math.floor(rule.minLevel))
    ) {
      return false;
    }

    if (
      rule.maxLevel !== undefined &&
      safeLevel > Math.max(1, Math.floor(rule.maxLevel))
    ) {
      return false;
    }

    return true;
  }

  private meetsLevelUpRequirements(
    rule: LevelUpRule,
    profile: RankProgressProfile,
  ) {
    if (!rule.requirements) {
      return true;
    }

    const stats = this.getAchievementStats(profile);

    return Object.entries(rule.requirements).every(
      ([rawKey, requiredValue]) => {
        const requirementKey = this.normalizeAchievementSubcategory(rawKey);
        const currentValue = Number(
          stats[requirementKey] ?? stats[rawKey] ?? 0,
        );

        return currentValue >= Math.max(0, Math.floor(requiredValue));
      },
    );
  }

  private meetsRankGate(rule: LevelUpRule, currentRank: string) {
    if (!rule.requireRank) {
      return true;
    }

    return (
      this.normalizeRankCode(rule.requireRank) ===
      this.normalizeRankCode(currentRank)
    );
  }

  private async buildNextRankProgress(
    profile: RankProgressProfile,
    rules?: LevelUpRule[],
  ) {
    const rulesList = rules ?? (await this.getLevelUpRules());
    const totalXp = this.getTotalXp(profile);
    const level = this.getLevelFromXp(totalXp);
    const effectiveCurrentRank = this.resolveRankByRulesOrFallback(
      profile,
      rulesList,
      level,
    );
    const normalizedCurrentRank = this.normalizeRankCode(effectiveCurrentRank);
    const sortedRules = [...rulesList].sort(
      (first, second) => first.requiredXp - second.requiredXp,
    );
    const currentIndex = sortedRules.findIndex(
      (rule) => this.normalizeRankCode(rule.rankCode) === normalizedCurrentRank,
    );
    const currentRankRule =
      currentIndex >= 0
        ? sortedRules[currentIndex]
        : this.getCurrentRankRule(
            profile,
            sortedRules,
            totalXp,
            effectiveCurrentRank,
          );
    const nextRule =
      currentIndex >= 0
        ? sortedRules[currentIndex + 1]
        : sortedRules.find((rule) => rule.requiredXp > totalXp);

    if (!nextRule) {
      return null;
    }

    const currentRankCode =
      this.normalizeRankCode(effectiveCurrentRank) ||
      this.normalizeRankCode(
        String(
          currentRankRule?.rankCode ??
            sortedRules[0]?.rankCode ??
            ExperienceLevel.F,
        ),
      ) ||
      ExperienceLevel.F;
    const currentRankRequiredXp = Math.max(
      0,
      Math.floor(currentRankRule?.requiredXp ?? 0),
    );
    const currentRankXp = Math.max(0, totalXp - currentRankRequiredXp);
    const rankBandSize = Math.max(
      1,
      nextRule.requiredXp - currentRankRequiredXp,
    );
    const progressPercentage = Math.max(
      0,
      Math.min(100, Math.round((currentRankXp / rankBandSize) * 100)),
    );
    const remainingXp = Math.max(0, nextRule.requiredXp - totalXp);
    const stats = this.getAchievementStats(profile);
    const requirements = nextRule.requirements ?? {};
    const remainingRequirements = Object.fromEntries(
      Object.entries(requirements).map(([rawKey, rawRequiredValue]) => {
        const requirementKey = this.normalizeAchievementSubcategory(rawKey);
        const requiredValue = Math.max(
          0,
          Math.floor(Number(rawRequiredValue) || 0),
        );
        const currentValue = Math.max(
          0,
          Math.floor(Number(stats[requirementKey] ?? stats[rawKey] ?? 0)),
        );

        return [requirementKey, Math.max(0, requiredValue - currentValue)];
      }),
    ) as Record<string, number>;

    const eligible =
      remainingXp === 0 &&
      Object.values(remainingRequirements).every((value) => value === 0) &&
      this.meetsRankGate(nextRule, currentRankCode) &&
      this.meetsLevelUpRequirements(nextRule, profile);

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

  private async buildRankProgress(
    profile: RankProgressProfile,
    rules?: LevelUpRule[],
  ) {
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
    const experienceLevel = this.resolveRankByRulesOrFallback(
      profile,
      rules,
      level,
    );
    const currentRankRule = this.getCurrentRankRule(
      profile,
      rules,
      totalXp,
      experienceLevel,
    );
    const currentRankRequiredXp = Math.max(
      0,
      Math.floor(currentRankRule?.requiredXp ?? 0),
    );
    const xp = Math.max(0, totalXp - currentRankRequiredXp);

    return {
      totalXp,
      xp,
      level,
      experienceLevel,
    };
  }

  private async applyLevelProgression(profile: User, rules?: LevelUpRule[]) {
    const levelUpRules = rules ?? (await this.getLevelUpRules());
    const snapshot = this.resolveProgressionSnapshot(profile, levelUpRules);

    const currentLevel = profile.level ?? 1;
    const currentRank = this.normalizeRankCode(
      String(profile.experienceLevel ?? ''),
    );
    const normalizedCurrentRank = this.normalizeRankCode(currentRank);
    const normalizedNextRank = this.normalizeRankCode(snapshot.experienceLevel);
    const levelDiffers = currentLevel !== snapshot.level;
    const rankDiffers = normalizedCurrentRank !== normalizedNextRank;
    const xpDiffers =
      Math.max(0, Math.floor(Number(profile.xp ?? 0))) !== snapshot.xp;

    const shouldUpdate = levelDiffers || rankDiffers || xpDiffers;

    if (!shouldUpdate) {
      await this.ensureRankBadgesAwarded(
        String(profile._id),
        snapshot.experienceLevel,
      );
      this.logger.debug(
        `No update needed for profile ${profile._id}: level=${currentLevel}, rank=${currentRank}, xp=${profile.xp}`,
      );
      return profile;
    }

    this.logger.log(
      `⚡ Updating profile ${profile._id}: level ${currentLevel}→${snapshot.level}, rank ${currentRank}→${snapshot.experienceLevel}, xp ${profile.xp}→${snapshot.xp}`,
    );

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
      this.logger.error(
        `❌ Profile update FAILED (null returned) for ${profile._id}`,
      );
      return profile;
    }

    this.logger.log(
      `✅ Profile updated: level=${updated.level}, rank=${updated.experienceLevel}, xp=${updated.xp}`,
    );
    await this.ensureRankBadgesAwarded(
      String(updated._id),
      snapshot.experienceLevel,
    );
    return updated;
  }

  private async applyLedgerBackedXpAward(
    profileId: string,
    entry: NonNullable<User['xpHistory']>[number],
  ): Promise<{ applied: boolean; profile: User }> {
    const reservation = await this.xpLedgerService.reserveXpAward({
      userId: profileId,
      xpAmount: Math.max(0, entry.points),
      eventCode: entry.eventKey,
      contextKey: entry.contextKey,
      description: entry.ruleName,
      metadata: {
        ruleCode: entry.ruleCode,
        ruleName: entry.ruleName,
        context: entry.context ?? {},
      },
    });
    const reservedPoints = Math.max(
      0,
      Math.floor(Number(reservation.ledger.xpAmount) || 0),
    );
    const historyEntry = {
      ...entry,
      points: reservedPoints,
    };
    const updated = await this.userModel.findOneAndUpdate(
      {
        _id: this.toObjectId(profileId),
        'xpHistory.contextKey': { $ne: entry.contextKey },
      },
      {
        ...(reservedPoints > 0 ? { $inc: { totalXp: reservedPoints } } : {}),
        $push: { xpHistory: historyEntry },
      },
      {
        new: true,
        runValidators: true,
      },
    );
    const current =
      updated ?? (await this.userModel.findById(this.toObjectId(profileId)));
    if (!current) {
      throw new NotFoundException('Profile not found while applying XP');
    }

    await this.xpLedgerService.markXpAwardApplied(
      String(reservation.ledger._id),
      this.getTotalXp(current),
    );
    return { applied: Boolean(updated), profile: current };
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

    if (REMOVED_XP_EVENT_KEYS.has(normalizedEventKey)) {
      throw new BadRequestException(
        'The daily streak XP event has been removed',
      );
    }

    const rules = await this.getEnabledXpRules();
    const matchingRules = rules.filter(
      (rule) => rule.eventKey === normalizedEventKey,
    );
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

      const shouldLog =
        options?.simulateOnly !== true || fallbackBreakdown.finalXp > 0;
      let totalAwarded = fallbackBreakdown.finalXp;
      const previousRank = profile.experienceLevel ?? 'F';
      let syncedProfile = profile;
      let updatedProfile: User | null | undefined = undefined;

      if (!options?.simulateOnly && shouldLog) {
        const applied = await this.applyLedgerBackedXpAward(
          String(profile._id),
          fallbackUpdate,
        );
        updatedProfile = applied.profile;
        totalAwarded = applied.applied ? fallbackUpdate.points : 0;

        syncedProfile = await this.applyLevelProgression(
          updatedProfile ?? profile,
        );
      }

      const levelUpRules = await this.getLevelUpRules();
      const newRank =
        (options?.simulateOnly
          ? previousRank
          : syncedProfile.experienceLevel) ?? previousRank;
      const rankProgressTarget = options?.simulateOnly
        ? profile
        : syncedProfile;
      const nextRankProgress = await this.buildRankProgress(
        rankProgressTarget,
        levelUpRules,
      );

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
        rule.repeat !== 'always' &&
        existingHistory.some((entry) => entry.contextKey === contextKey);

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

    let totalAwarded = updates.reduce(
      (total, entry) => total + Math.max(0, entry.points),
      0,
    );
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

    const appliedUpdates: NonNullable<User['xpHistory']> = [];
    let updatedProfile: User | null = null;
    for (const entry of updates) {
      const result = await this.applyLedgerBackedXpAward(
        String(profile._id),
        entry,
      );
      updatedProfile = result.profile;
      if (result.applied) {
        appliedUpdates.push(entry);
      }
    }
    totalAwarded = appliedUpdates.reduce(
      (total, entry) => total + Math.max(0, entry.points),
      0,
    );

    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );
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
      appliedRules: appliedUpdates.map((entry) => ({
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
    const xpResult = await this.evaluateXpForProfile(
      profile,
      eventKey,
      context,
    );
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

    await this.assertManagedUser(profile);

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
      return this.simulateXpForProfileEvent(
        profileId.trim(),
        eventKey,
        context,
      );
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
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const history = [...(profile.xpHistory ?? [])].sort(
      (first, second) =>
        new Date(second.awardedAt).getTime() -
        new Date(first.awardedAt).getTime(),
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

  async adminGetXpHistory(profileId: string, page = 1, limit = 20) {
    const profile = await this.userModel.findById(this.toObjectId(profileId));

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.assertManagedUser(profile);

    const history = [...(profile.xpHistory ?? [])].sort(
      (first, second) =>
        new Date(second.awardedAt).getTime() -
        new Date(first.awardedAt).getTime(),
    );
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const startIndex = (safePage - 1) * safeLimit;

    return {
      items: history.slice(startIndex, startIndex + safeLimit),
      pagination: {
        total: history.length,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(history.length / safeLimit)),
      },
      currentXp: this.getTotalXp(profile),
      level: profile.level ?? 1,
      rank: profile.experienceLevel ?? ExperienceLevel.F,
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

    await this.assertManagedUser(profile);

    const newPoints = Math.max(0, Math.floor(Number(payload.points)));

    if (!Number.isFinite(newPoints)) {
      throw new BadRequestException(
        'points must be a valid non-negative number',
      );
    }

    if (!String(payload.reason ?? '').trim()) {
      throw new BadRequestException(
        'reason is required for XP history updates',
      );
    }

    const history = [...(profile.xpHistory ?? [])];
    const index = history.findIndex((entry) => {
      const entryId = String(
        (entry as unknown as { _id?: unknown })._id ?? '',
      ).trim();
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

    const nextTotalXp = Math.max(
      0,
      Math.floor(Number(this.getTotalXp(profile)) + delta),
    );

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

    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );
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
      nextRankProgress: await this.buildRankProgress(
        syncedProfile,
        levelUpRules,
      ),
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

    await this.assertManagedUser(profile);

    const history = [...(profile.xpHistory ?? [])];
    const index = history.findIndex((entry) => {
      const entryId = String(
        (entry as unknown as { _id?: unknown })._id ?? '',
      ).trim();
      return entryId === historyId;
    });

    if (index === -1) {
      throw new NotFoundException('XP history entry not found');
    }

    if (!String(reason ?? '').trim()) {
      throw new BadRequestException(
        'reason is required for XP history deletion',
      );
    }

    const existing = history[index];
    const deletedPoints = Math.max(0, Math.floor(Number(existing.points ?? 0)));
    history.splice(index, 1);

    const nextTotalXp = Math.max(
      0,
      Math.floor(Number(this.getTotalXp(profile)) - deletedPoints),
    );

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

    const syncedProfile = await this.applyLevelProgression(
      updatedProfile ?? profile,
    );
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
      nextRankProgress: await this.buildRankProgress(
        syncedProfile,
        levelUpRules,
      ),
    };
  }

  async adminAddXpToUser(
    profileId: string,
    xpToAdd: number,
    adminId: string,
    reason: string,
  ) {
    const profile = await this.userModel.findById(profileId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.assertManagedUser(profile);

    // Validate input
    const safeXp = Math.max(1, Math.min(500, Math.floor(Number(xpToAdd))));

    if (!Number.isFinite(safeXp) || safeXp < 1 || safeXp > 500) {
      throw new BadRequestException('XP to add must be between 1 and 500');
    }

    if (!String(reason ?? '').trim()) {
      throw new BadRequestException('Reason is required for XP additions');
    }

    try {
      this.logger.log(
        `🎯 Adding ${safeXp} XP to user ${profileId} (current totalXp: ${profile.totalXp})`,
      );

      // Store previous state
      const previousXp = Math.max(0, Math.floor(Number(profile.xp ?? 0)));
      const previousTotalXp = this.getTotalXp(profile);
      const previousLevel = profile.level ?? 1;
      const previousRank = profile.experienceLevel ?? 'F';

      this.logger.log(
        `  Before: level=${previousLevel}, rank=${previousRank}, totalXp=${previousTotalXp}, currentXp=${previousXp}`,
      );

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

      this.logger.log(
        `  Updating totalXp: ${previousTotalXp} → ${nextTotalXp}`,
      );

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

      if (!updatedProfile) {
        throw new NotFoundException('Failed to update profile');
      }

      this.logger.log(
        `  ✅ XP updated in DB: totalXp now = ${updatedProfile.totalXp}`,
      );
      this.logger.log(`  Now applying level progression...`);

      // Apply level progression (this automatically updates level and rank based on new totalXp)
      await this.applyLevelProgression(updatedProfile);

      // Force refresh from DB to ensure we have the latest data
      const syncedProfile = await this.userModel.findById(profileId);
      if (!syncedProfile) {
        throw new NotFoundException('Profile lost after update');
      }

      this.logger.log(
        `  🔄 Refreshed from DB: level=${syncedProfile.level}, rank=${syncedProfile.experienceLevel}`,
      );

      const levelUpRules = await this.getLevelUpRules();
      const newLevel = syncedProfile.level ?? previousLevel;
      const newRank = syncedProfile.experienceLevel ?? previousRank;
      const newXp = Math.max(0, Math.floor(Number(syncedProfile.xp ?? 0)));

      this.logger.log(
        `  After: level=${newLevel}, rank=${newRank}, totalXp=${syncedProfile.totalXp}, currentXp=${newXp}`,
      );

      // Determine if rank actually changed
      const rankChanged =
        this.normalizeKey(previousRank) !== this.normalizeKey(newRank);
      const levelChanged = previousLevel !== newLevel;

      this.logger.log(
        `  Comparison: rankChanged=${rankChanged} (${previousRank}→${newRank}), levelChanged=${levelChanged} (${previousLevel}→${newLevel})`,
      );

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
        autoRankUpReason: rankChanged
          ? `Rank automatically updated from ${previousRank} to ${newRank} due to level progression`
          : undefined,
        nextRankProgress: await this.buildRankProgress(
          syncedProfile,
          levelUpRules,
        ),
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
          message:
            'Rank-up achievements not completed. User remains at previous rank.',
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
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.referredByAuthId) {
      throw new BadRequestException('Referrer is already set for this profile');
    }

    const referrer = await this.userModel
      .findById(this.toObjectId(referrerProfileId))
      .select('authId');

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
    const recipient = await this.userModel.findById(
      this.toObjectId(payload.toProfileId),
    );

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
      (entry) =>
        entry.campaignId === normalizedCampaignId &&
        entry.raterAuthId.toString() === raterAuthObjectId.toString(),
    );

    if (alreadyRated) {
      throw new BadRequestException(
        'You already submitted a rating for this campaign and profile',
      );
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

  private async hashTrustedEvidenceImage(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Evidence photo URL is invalid');
    }
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME ?? '').trim();
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      (cloudName && !url.pathname.startsWith(`/${cloudName}/`))
    ) {
      throw new BadRequestException(
        'Evidence photo must use the configured TripSathi Cloudinary account',
      );
    }
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadRequestException(
        'Evidence photo could not be verified. Upload it again.',
      );
    }
    const contentType = response.headers.get('content-type') ?? '';
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (
      !response.ok ||
      !contentType.startsWith('image/') ||
      (contentLength > 0 && contentLength > 12 * 1024 * 1024)
    ) {
      throw new BadRequestException('Evidence must be an image under 12 MB');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1 || bytes.length > 12 * 1024 * 1024) {
      throw new BadRequestException('Evidence must be an image under 12 MB');
    }
    return createHash('sha256').update(bytes).digest('hex');
  }

  private async assertPlaceEvidenceStillValid(
    request: NonNullable<User['photoVerificationRequests']>[number],
  ) {
    if (
      request.latitude == null ||
      request.longitude == null ||
      !request.place ||
      !request.district ||
      !request.municipality
    ) {
      throw new BadRequestException(
        'Place evidence is missing required GPS or catalog data',
      );
    }
    const hierarchy = await this.placesService.getHierarchy({
      includeDeleted: false,
    });
    const place = hierarchy.provinces
      .flatMap((province) => province.districts)
      .filter(
        (district) =>
          district.name.trim().toLowerCase() ===
          request.district!.trim().toLowerCase(),
      )
      .flatMap((district) => district.municipalities)
      .filter(
        (municipality) =>
          municipality.name.trim().toLowerCase() ===
          request.municipality!.trim().toLowerCase(),
      )
      .flatMap((municipality) => municipality.places)
      .find(
        (candidate) =>
          candidate.name.trim().toLowerCase() ===
          request.place!.trim().toLowerCase(),
      );
    if (
      !place ||
      !Number.isFinite(place.latitude) ||
      !Number.isFinite(place.longitude)
    ) {
      throw new BadRequestException(
        'The catalog place is disabled or has no trusted coordinates',
      );
    }
    const radius = place.verificationRadiusMeters ?? 500;
    const distance = haversineDistanceMeters(
      { latitude: request.latitude, longitude: request.longitude },
      { latitude: place.latitude!, longitude: place.longitude! },
    );
    if (distance > radius) {
      throw new BadRequestException(
        `Evidence is ${Math.round(distance)} metres from the trusted place coordinates; maximum is ${radius} metres`,
      );
    }
  }

  private async awardStandalonePlaceVerificationXp(
    profile: User,
    request: NonNullable<User['photoVerificationRequests']>[number],
  ) {
    const locationKey = [request.district, request.municipality, request.place]
      .map((value) => this.normalizeKey(String(value ?? '')))
      .join(':');
    const contextKey = `standalone_place_verified:${locationKey}`;
    const result = await this.applyLedgerBackedXpAward(String(profile._id), {
      eventKey: 'standalone_place_verified',
      ruleCode: 'SYS-STANDALONE-PLACE-V1',
      ruleName: 'Verified standalone place visit',
      points: STANDALONE_PLACE_VERIFICATION_XP,
      contextKey,
      context: {
        requestCode: request.requestCode,
        district: request.district,
        municipality: request.municipality,
        placeName: request.place,
        policyVersion: 1,
      },
      awardedAt: new Date(),
    });
    if (!result.applied) {
      return {
        eventKey: 'standalone_place_verified',
        totalAwarded: 0,
        appliedRules: [],
        idempotent: true,
      };
    }
    const synced = await this.applyLevelProgression(result.profile);
    return {
      eventKey: 'standalone_place_verified',
      totalAwarded: STANDALONE_PLACE_VERIFICATION_XP,
      currentXp: this.getTotalXp(synced),
      appliedRules: [
        {
          ruleCode: 'SYS-STANDALONE-PLACE-V1',
          ruleName: 'Verified standalone place visit',
          points: STANDALONE_PLACE_VERIFICATION_XP,
        },
      ],
      idempotent: false,
    };
  }

  async createPhotoVerificationRequest(
    authId: string,
    payload: {
      campaignId?: string;
      url: string;
      kind: 'group' | 'solo';
      title?: string;
      category?: string;
      province?: string;
      district?: string;
      municipality?: string;
      place?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      locationAccuracyMeters?: number;
      locationCapturedAt?: string;
      travelerUrl?: string;
    },
  ) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const account = await this.authModel
      .findById(profile.authId)
      .select(
        'role verificationRequired emailVerifiedAt phoneVerifiedAt isActive',
      );
    if (!account || account.isActive === false) {
      throw new ForbiddenException('Account is not active');
    }
    if (account.role !== Role.User) {
      throw new ForbiddenException(
        'Only user accounts can submit place evidence',
      );
    }
    if (
      account.verificationRequired === true &&
      !account.emailVerifiedAt &&
      !account.phoneVerifiedAt
    ) {
      throw new ForbiddenException(
        'Verify your email or phone number before submitting evidence',
      );
    }

    const campaignId = String(payload.campaignId ?? '').trim();
    const isPlaceEvidence = Boolean(payload.place?.trim());
    if (!campaignId && !isPlaceEvidence) {
      throw new BadRequestException(
        'Choose a valid catalog place for standalone photo verification',
      );
    }

    let placeSelection:
      | {
          province: string;
          district: string;
          municipality: string;
          place: string;
          latitude: number;
          longitude: number;
          verificationRadiusMeters: number;
        }
      | undefined;
    if (isPlaceEvidence) {
      if (!payload.travelerUrl?.trim()) {
        throw new BadRequestException(
          'Add a second photo showing you together with the visited place',
        );
      }
      if (
        !payload.title?.trim() ||
        !payload.category?.trim() ||
        !payload.address?.trim()
      ) {
        throw new BadRequestException(
          'title, category and address are required for place verification',
        );
      }
      const hierarchy = await this.placesService.getHierarchy({
        includeDeleted: false,
      });
      const placeKey = payload.place!.trim().toLowerCase();
      const provinceKey = payload.province?.trim().toLowerCase();
      const districtKey = payload.district?.trim().toLowerCase();
      const municipalityKey = payload.municipality?.trim().toLowerCase();
      const matches = hierarchy.provinces.flatMap((province) =>
        province.districts.flatMap((district) =>
          district.municipalities.flatMap((municipality) =>
            municipality.places
              .filter(
                (place) =>
                  place.name.trim().toLowerCase() === placeKey &&
                  (!municipalityKey ||
                    municipality.name.trim().toLowerCase() ===
                      municipalityKey) &&
                  (!provinceKey ||
                    province.name.trim().toLowerCase() === provinceKey) &&
                  (!districtKey ||
                    district.name.trim().toLowerCase() === districtKey),
              )
              .map((place) => ({
                province: province.name,
                district: district.name,
                municipality: municipality.name,
                place: place.name,
                latitude: place.latitude,
                longitude: place.longitude,
                verificationRadiusMeters: place.verificationRadiusMeters ?? 500,
              })),
          ),
        ),
      );
      if (matches.length !== 1) {
        throw new BadRequestException(
          matches.length === 0
            ? 'Selected place is not in the active Nepal place catalog'
            : 'Selected place is ambiguous; choose its district and province',
        );
      }
      const selectedPlace = matches[0];
      if (
        !Number.isFinite(selectedPlace.latitude) ||
        !Number.isFinite(selectedPlace.longitude)
      ) {
        throw new BadRequestException(
          'This place cannot accept verification until an admin adds trusted coordinates',
        );
      }
      placeSelection = {
        ...selectedPlace,
        latitude: selectedPlace.latitude!,
        longitude: selectedPlace.longitude!,
      };
      const duplicate = (profile.photoVerificationRequests ?? []).find(
        (entry) =>
          ['pending', 'approved'].includes(entry.status) &&
          entry.place?.trim().toLowerCase() ===
            placeSelection!.place.toLowerCase() &&
          entry.municipality?.trim().toLowerCase() ===
            placeSelection!.municipality.toLowerCase() &&
          entry.district?.trim().toLowerCase() ===
            placeSelection!.district.toLowerCase(),
      );
      if (duplicate) {
        throw new BadRequestException(
          duplicate.status === 'approved'
            ? 'This place is already completed'
            : 'This place already has a pending verification request',
        );
      }
    }

    if ((payload.latitude == null) !== (payload.longitude == null)) {
      throw new BadRequestException(
        'latitude and longitude must be provided together',
      );
    }
    if (
      isPlaceEvidence &&
      (payload.latitude == null || payload.longitude == null)
    ) {
      throw new BadRequestException(
        'Current GPS location is required for place verification',
      );
    }
    if (
      isPlaceEvidence &&
      (!Number.isFinite(payload.locationAccuracyMeters) ||
        payload.locationAccuracyMeters! > 100)
    ) {
      throw new BadRequestException(
        'GPS accuracy must be 100 metres or better. Move outdoors and try again.',
      );
    }
    const capturedAt = payload.locationCapturedAt
      ? new Date(payload.locationCapturedAt)
      : null;
    if (
      isPlaceEvidence &&
      (!capturedAt ||
        Number.isNaN(capturedAt.getTime()) ||
        Math.abs(Date.now() - capturedAt.getTime()) > 15 * 60 * 1000)
    ) {
      throw new BadRequestException(
        'Capture a fresh GPS location before submitting evidence',
      );
    }
    if (
      payload.latitude != null &&
      (payload.latitude < 26.3 ||
        payload.latitude > 30.5 ||
        payload.longitude! < 80.0 ||
        payload.longitude! > 88.3)
    ) {
      throw new BadRequestException('Photo location must be inside Nepal');
    }

    const distanceFromPlaceMeters =
      placeSelection && payload.latitude != null
        ? haversineDistanceMeters(
            {
              latitude: payload.latitude,
              longitude: payload.longitude!,
            },
            {
              latitude: placeSelection.latitude,
              longitude: placeSelection.longitude,
            },
          )
        : null;
    if (
      placeSelection &&
      distanceFromPlaceMeters! > placeSelection.verificationRadiusMeters
    ) {
      throw new BadRequestException(
        `You are ${Math.round(distanceFromPlaceMeters!)} metres from ${placeSelection.place}; move within ${placeSelection.verificationRadiusMeters} metres to submit evidence`,
      );
    }

    const evidenceHash = isPlaceEvidence
      ? await this.hashTrustedEvidenceImage(payload.url)
      : undefined;
    const travelerEvidenceHash = isPlaceEvidence
      ? await this.hashTrustedEvidenceImage(payload.travelerUrl!)
      : undefined;
    if (evidenceHash && evidenceHash === travelerEvidenceHash) {
      throw new BadRequestException(
        'The place photo and traveler photo must be different images',
      );
    }
    if (
      evidenceHash &&
      (await this.userModel.exists({
        photoVerificationRequests: {
          $elemMatch: {
            evidenceHash,
            status: { $in: ['pending', 'approved'] },
          },
        },
      }))
    ) {
      throw new BadRequestException(
        'This exact photo was already submitted for verification',
      );
    }

    const requestCode = `PVR-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const request = {
      requestCode,
      campaignId,
      url: String(payload.url).trim(),
      ...(payload.travelerUrl?.trim()
        ? { travelerUrl: payload.travelerUrl.trim() }
        : {}),
      kind: payload.kind,
      status: 'pending' as const,
      submittedAt: new Date(),
      ...(placeSelection
        ? {
            title: payload.title!.trim(),
            category: payload.category!.trim(),
            ...placeSelection,
            address: payload.address!.trim(),
            ...(payload.latitude != null
              ? {
                  latitude: payload.latitude,
                  longitude: payload.longitude,
                  locationAccuracyMeters: payload.locationAccuracyMeters,
                  locationCapturedAt: capturedAt,
                  distanceFromPlaceMeters,
                  allowedRadiusMeters: placeSelection.verificationRadiusMeters,
                }
              : {}),
            evidenceHash,
          }
        : {}),
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
    let profile = await this.userModel.findById(this.toObjectId(profileId));

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

    if (
      requests[index].status !== 'pending' &&
      requests[index].status !== review.status
    ) {
      throw new BadRequestException(
        `Photo verification request was already ${requests[index].status}`,
      );
    }

    if (
      requests[index].status === 'pending' &&
      review.status === 'rejected' &&
      !review.reviewNote?.trim()
    ) {
      throw new BadRequestException(
        'A rejection reason is required so the user can correct or appeal it',
      );
    }

    if (
      requests[index].status === 'pending' &&
      review.status === 'approved' &&
      requests[index].place
    ) {
      await this.assertPlaceEvidenceStillValid(requests[index]);
    }

    let transitioned = false;
    if (requests[index].status === 'pending') {
      const updated = await this.userModel.findOneAndUpdate(
        {
          _id: profile._id,
          photoVerificationRequests: {
            $elemMatch: { requestCode, status: 'pending' },
          },
        },
        {
          $set: {
            'photoVerificationRequests.$[request].status': review.status,
            'photoVerificationRequests.$[request].reviewedAt': new Date(),
            'photoVerificationRequests.$[request].reviewedByAuthId':
              this.toObjectId(adminAuthId),
            'photoVerificationRequests.$[request].reviewNote':
              review.reviewNote?.trim() || null,
          },
        },
        {
          arrayFilters: [
            {
              'request.requestCode': requestCode,
              'request.status': 'pending',
            },
          ],
          new: true,
          runValidators: true,
        },
      );
      transitioned = Boolean(updated);
      profile =
        updated ?? (await this.userModel.findById(this.toObjectId(profileId)));
      if (!profile) {
        throw new NotFoundException('Profile not found');
      }
    }

    const reviewedRequest = (profile.photoVerificationRequests ?? []).find(
      (entry) => entry.requestCode === requestCode,
    );
    if (!reviewedRequest) {
      throw new NotFoundException('Photo verification request not found');
    }
    if (reviewedRequest.status !== review.status) {
      throw new BadRequestException(
        `Photo verification request was already ${reviewedRequest.status}`,
      );
    }

    let xp: Record<string, unknown> | null = null;

    if (review.status === 'approved') {
      xp = reviewedRequest.campaignId
        ? await this.awardXpForEvent(
            profile.authId.toString(),
            reviewedRequest.kind === 'solo'
              ? 'solo_photo_uploaded'
              : 'group_photo_uploaded',
            {
              campaignId: reviewedRequest.campaignId,
              solo: reviewedRequest.kind === 'solo',
              district: reviewedRequest.district,
              placeName: reviewedRequest.place,
              locationKey: reviewedRequest.place,
            },
          )
        : await this.awardStandalonePlaceVerificationXp(
            profile,
            reviewedRequest,
          );
      if (!reviewedRequest.campaignId && reviewedRequest.district) {
        const sourceId = `place-verification:${reviewedRequest.requestCode}`;
        await Promise.all([
          this.visitedPlaceService.recordVisit(
            String(profile._id),
            reviewedRequest.district,
            'district',
            new Date(),
            sourceId,
          ),
          ...(reviewedRequest.province
            ? [
                this.visitedPlaceService.recordVisit(
                  String(profile._id),
                  reviewedRequest.province,
                  'province',
                  new Date(),
                  sourceId,
                ),
              ]
            : []),
        ]);
      }
    }

    return {
      message: `Photo verification request ${review.status}`,
      request: reviewedRequest,
      idempotent: !transitioned,
      ...(xp ? { xp } : {}),
    };
  }

  async appealPhotoVerificationRequest(
    authId: string,
    requestCode: string,
    appealNote: string,
  ) {
    const normalizedRequestCode = requestCode.trim();
    const updated = await this.userModel.findOneAndUpdate(
      {
        authId: this.toObjectId(authId),
        photoVerificationRequests: {
          $elemMatch: {
            requestCode: normalizedRequestCode,
            status: 'rejected',
            $or: [
              { appealCount: { $exists: false } },
              { appealCount: { $lt: 1 } },
            ],
          },
        },
      },
      {
        $set: {
          'photoVerificationRequests.$[request].status': 'pending',
          'photoVerificationRequests.$[request].appealNote': appealNote.trim(),
          'photoVerificationRequests.$[request].appealedAt': new Date(),
        },
        $inc: { 'photoVerificationRequests.$[request].appealCount': 1 },
        $unset: {
          'photoVerificationRequests.$[request].reviewedAt': '',
          'photoVerificationRequests.$[request].reviewedByAuthId': '',
        },
      },
      {
        arrayFilters: [
          {
            'request.requestCode': normalizedRequestCode,
            'request.status': 'rejected',
          },
        ],
        new: true,
        runValidators: true,
      },
    );
    if (updated) {
      const appealedRequest = (updated.photoVerificationRequests ?? []).find(
        (entry) => entry.requestCode === normalizedRequestCode,
      );
      if (!appealedRequest) {
        throw new NotFoundException('Photo verification request not found');
      }
      return {
        message: 'Appeal submitted for a second review',
        request: appealedRequest,
      };
    }

    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const existing = (profile.photoVerificationRequests ?? []).find(
      (entry) => entry.requestCode === normalizedRequestCode,
    );
    if (!existing) {
      throw new NotFoundException('Photo verification request not found');
    }
    if ((existing.appealCount ?? 0) >= 1) {
      throw new BadRequestException(
        'This decision has already been appealed. Submit new evidence instead.',
      );
    }
    if (existing.status !== 'rejected') {
      throw new BadRequestException('Only a rejected request can be appealed');
    }

    throw new BadRequestException(
      'The request changed while the appeal was submitted. Refresh and try again.',
    );
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

    const authUpdates: Record<string, string | Date | boolean | null> = {};

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
        authUpdates.phoneVerifiedAt = null;
        authUpdates.verificationRequired = true;
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
        authUpdates.emailVerifiedAt = null;
        authUpdates.verificationRequired = true;
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

  async createProfile(
    authId: string,
    initial?: {
      firstName?: string | null;
      middleName?: string | null;
      lastName?: string | null;
      location?: string | null;
      gender?: Gender | null;
      dateOfBirth?: string | null;
    },
    session?: ClientSession,
  ) {
    const parsedDateOfBirth = initial?.dateOfBirth
      ? new Date(initial.dateOfBirth)
      : null;
    const profileData = {
      authId: this.toObjectId(authId),
      profileCompleted: false,
      xp: 0,
      totalXp: 0,
      level: 1,
      experienceLevel: ExperienceLevel.F,
      badge: '',
      isProfilePublic: true,
      ...(initial?.firstName?.trim()
        ? { firstName: initial.firstName.trim() }
        : {}),
      ...(initial?.middleName?.trim()
        ? { middleName: initial.middleName.trim() }
        : {}),
      ...(initial?.lastName?.trim()
        ? { lastName: initial.lastName.trim() }
        : {}),
      ...(initial?.location?.trim()
        ? { location: initial.location.trim() }
        : {}),
      ...(initial?.gender ? { gender: initial.gender } : {}),
      ...(parsedDateOfBirth
        ? {
            dateOfBirth: parsedDateOfBirth,
            age: this.calculateAge(parsedDateOfBirth),
          }
        : {}),
    };
    const created = session
      ? (await this.userModel.create([profileData], { session }))[0]
      : await this.userModel.create(profileData);

    // New profiles already use the initial progression defaults. Avoid issuing
    // a second, non-session update while account creation is still uncommitted.
    return session ? created : this.applyLevelProgression(created);
  }

  async getProfileByAuthId(authId: string) {
    const profile = await this.userModel.findOne({
      authId: this.toObjectId(authId),
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const shouldBeComplete =
      this.missingRequiredProfileFields(
        profile.toObject() as unknown as Record<string, unknown>,
      ).length === 0;
    if (profile.profileCompleted !== shouldBeComplete) {
      profile.profileCompleted = shouldBeComplete;
      await profile.save();
    }

    const levelUpRules = await this.getLevelUpRules();
    const syncedProfile = await this.applyLevelProgression(
      profile,
      levelUpRules,
    );
    return this.attachAuthContactInfo(syncedProfile, levelUpRules);
  }

  async getPublicProfileById(profileId: string) {
    const profile = await this.userModel
      .findOne({
        _id: this.toObjectId(profileId),
        isProfilePublic: true,
        profileCompleted: true,
      })
      .select(
        '-authId -xp -totalXp -badge -updatedAt -__v -profilePhotoPublicId',
      );

    if (!profile) {
      throw new NotFoundException('Public profile not found');
    }

    return {
      ...profile.toObject(),
      level: profile.level ?? 1,
      experienceLevel: profile.experienceLevel ?? ExperienceLevel.F,
    };
  }

  private missingRequiredProfileFields(profile: Record<string, unknown>) {
    const missing: string[] = [];
    const text = (key: string) => String(profile[key] ?? '').trim();
    if (text('firstName').length < 2) missing.push('firstName');
    if (text('lastName').length < 2) missing.push('lastName');
    if (!text('location')) missing.push('location');
    if (!text('gender')) missing.push('gender');
    if (!text('dateOfBirth')) missing.push('dateOfBirth');
    if (!text('profilePhoto')) missing.push('profilePhoto');
    if (text('bio').length < 20) missing.push('bio');
    if (!text('travelerExperience')) missing.push('travelerExperience');
    if (!text('travelStyle')) missing.push('travelStyle');
    if (
      !Array.isArray(profile.travelInterests) ||
      profile.travelInterests.length < 2
    ) {
      missing.push('travelInterests');
    }
    if (
      !Array.isArray(profile.languagesKnown) ||
      profile.languagesKnown.length < 1
    ) {
      missing.push('languagesKnown');
    }
    return missing;
  }

  async updateOwnProfile(
    authId: string,
    updates: UpdateProfileDto,
    requireComplete = false,
  ) {
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

    const mergedProfile = {
      ...(profile.toObject() as unknown as Record<string, unknown>),
      ...sanitizedUpdates,
    };
    const missingFields = this.missingRequiredProfileFields(mergedProfile);
    if (requireComplete && missingFields.length > 0) {
      throw new BadRequestException(
        `Complete these required profile fields: ${missingFields.join(', ')}`,
      );
    }

    const updatedProfile = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        ...sanitizedUpdates,
        profileCompleted: missingFields.length === 0,
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
    const syncedProfile = await this.applyLevelProgression(
      updatedProfile,
      levelUpRules,
    );
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
        .select(
          '-authId -xp -totalXp -badge -updatedAt -__v -profilePhotoPublicId',
        )
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
          nextRankProgress: await this.buildRankProgress(
            syncedItem,
            levelUpRules,
          ),
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
    status?: 'all' | 'active' | 'inactive' | 'complete' | 'incomplete';
  }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = pagination.q?.trim();
    const status = pagination.status ?? 'all';
    const filter: Record<string, unknown> = {};
    const userAuthIds = await this.authModel.distinct('_id', {
      role: Role.User,
    });
    filter.authId = { $in: userAuthIds };

    if (status === 'active') {
      filter.isActive = { $ne: false };
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'complete') {
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
        .select(
          '-xpHistory -receivedRatings -photoVerificationRequests -adminFlags -profilePhotoPublicId -__v',
        )
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
          role: Role.User,
          nextRankProgress: await this.buildRankProgress(
            syncedItem,
            levelUpRules,
          ),
        };
      }),
    );

    // If BadgeService is available, fetch persisted badges/counts for each profile
    let enrichedItems = syncedItems as any[];
    try {
      if (this.badgeService) {
        enrichedItems = await Promise.all(
          syncedItems.map(async (it: any) => {
            const profileId = String(it._id ?? '');
            if (!profileId) return it;
            const userBadges =
              await this.badgeService?.getUserBadges(profileId);
            const badgeCount =
              await this.badgeService?.getBadgeCount(profileId);
            return { ...it, userBadges, badgeCount };
          }),
        );
      }
    } catch (err) {
      this.logger.debug(
        'Failed to enrich admin profiles with badges',
        err as Error,
      );
    }

    return {
      items: enrichedItems,
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
    const userAuthIds = await this.authModel.distinct('_id', {
      role: Role.User,
    });

    const pipeline: PipelineStage[] = [
      { $match: { authId: { $in: userAuthIds } } },
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
                travelerUrl: '$photoVerificationRequests.travelerUrl',
                kind: '$photoVerificationRequests.kind',
                status: '$photoVerificationRequests.status',
                submittedAt: '$photoVerificationRequests.submittedAt',
                reviewedAt: '$photoVerificationRequests.reviewedAt',
                reviewedByAuthId: '$photoVerificationRequests.reviewedByAuthId',
                reviewNote: '$photoVerificationRequests.reviewNote',
                title: '$photoVerificationRequests.title',
                category: '$photoVerificationRequests.category',
                requestProvince: '$photoVerificationRequests.province',
                requestDistrict: '$photoVerificationRequests.district',
                municipality: '$photoVerificationRequests.municipality',
                place: '$photoVerificationRequests.place',
                address: '$photoVerificationRequests.address',
                latitude: '$photoVerificationRequests.latitude',
                longitude: '$photoVerificationRequests.longitude',
                locationAccuracyMeters:
                  '$photoVerificationRequests.locationAccuracyMeters',
                locationCapturedAt:
                  '$photoVerificationRequests.locationCapturedAt',
                distanceFromPlaceMeters:
                  '$photoVerificationRequests.distanceFromPlaceMeters',
                allowedRadiusMeters:
                  '$photoVerificationRequests.allowedRadiusMeters',
                appealNote: '$photoVerificationRequests.appealNote',
                appealedAt: '$photoVerificationRequests.appealedAt',
                appealCount: '$photoVerificationRequests.appealCount',
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    );

    const [result] = await this.userModel.aggregate(pipeline);
    let items = (result?.items ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      profileId: String(item.profileId),
      reviewedByAuthId: item.reviewedByAuthId
        ? String(item.reviewedByAuthId)
        : undefined,
    }));

    // Enrich items with persisted badges when possible
    try {
      if (this.badgeService && items.length > 0) {
        items = await Promise.all(
          items.map(async (it: any) => {
            const profileId = String(it.profileId ?? '');
            if (!profileId) return it;
            const userBadges =
              await this.badgeService?.getUserBadges(profileId);
            const badgeCount =
              await this.badgeService?.getBadgeCount(profileId);
            return { ...it, userBadges, badgeCount };
          }),
        );
      }
    } catch (err) {
      this.logger.debug(
        'Failed to enrich photo verification queue items with badges',
        err as Error,
      );
    }

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

    await this.assertManagedUser(profile);

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

    await this.assertManagedUser(profile);

    // Safety: disallow changing auth role or admin flags via profile update endpoint.
    if (
      (updates as any)?.role !== undefined ||
      Object.prototype.hasOwnProperty.call(updates, 'adminFlags')
    ) {
      throw new BadRequestException(
        'Cannot modify role or adminFlags via profile endpoint',
      );
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
    const objectId = this.toObjectId(profileId);
    const profile = await this.userModel.findById(objectId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.assertManagedUser(profile);

    if (profile.isActive !== false) {
      const deactivatedAt = new Date();
      profile.isActive = false;
      profile.deactivatedAt = deactivatedAt;
      await profile.save();

      await this.authModel.findByIdAndUpdate(profile.authId, {
        isActive: false,
        deactivatedAt,
        refreshTokenHash: null,
        refreshTokens: [],
      });

      return {
        action: 'deactivated' as const,
        isActive: false,
        message: 'User deactivated successfully',
      };
    }

    await this.userModel.findByIdAndDelete(objectId);

    if (profile.profilePhotoPublicId) {
      await this.cloudinaryService.deleteImage(profile.profilePhotoPublicId);
    }

    await this.authModel.findByIdAndDelete(profile.authId);

    return {
      action: 'deleted' as const,
      message: 'User permanently deleted successfully',
    };
  }

  async adminUpdateCampaignQuota(
    profileId: string,
    body: { campaignQuota: number; resetToJanFirst?: boolean },
  ) {
    const profile = await this.userModel.findById(this.toObjectId(profileId));

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.assertManagedUser(profile);

    profile.campaignQuota = Math.max(
      0,
      Math.floor(Number(body.campaignQuota ?? 0)),
    );

    if (body.resetToJanFirst) {
      const nowYear = new Date().getUTCFullYear();
      profile.campaignQuotaResetAt = new Date(Date.UTC(nowYear, 0, 1));
    }

    await profile.save();

    return { message: 'Campaign quota updated' };
  }

  private async assertManagedUser(profile: User): Promise<void> {
    const isUser = await this.authModel.exists({
      _id: profile.authId,
      role: Role.User,
    });

    if (!isUser) {
      // Return the same response as an unknown profile so this management API
      // does not disclose or permit mutations of privileged accounts.
      throw new NotFoundException('User profile not found');
    }
  }

  private async attachAuthContactInfo(profile: User, rules?: LevelUpRule[]) {
    const levelUpRules = rules ?? (await this.getLevelUpRules());
    const snapshot = this.resolveProgressionSnapshot(profile, levelUpRules);
    const auth = await this.authModel
      .findById(profile.authId)
      .select(
        'phoneNumber email role emailVerifiedAt phoneVerifiedAt verificationRequired',
      );
    const rankBadgeDefinitions = await this.getRankBadgeDefinitions();
    const unlockedRankBadges = this.getUnlockedRankBadges(
      snapshot.experienceLevel ?? ExperienceLevel.F,
      rankBadgeDefinitions,
    );
    const currentRankBadge =
      unlockedRankBadges.find((badge) => badge.isCurrentRank) ?? null;
    await this.ensureRankBadgesAwarded(
      String(profile._id),
      snapshot.experienceLevel ?? ExperienceLevel.F,
      rankBadgeDefinitions,
    );
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
    // If BadgeService is available, fetch persisted user badges and include count
    let userBadges = [] as any[];
    let badgeCount = 0;

    try {
      if (this.badgeService && profile._id) {
        // badgeService may be a circular dependency; call if available
        // BadgeService.getUserBadges expects a userId (profile._id)
        // Use toString() to pass as string id

        userBadges = await this.badgeService.getUserBadges(String(profile._id));

        badgeCount = await this.badgeService.getBadgeCount(String(profile._id));
      }
    } catch (err) {
      // Non-fatal: if badges cannot be loaded, continue without them
      this.logger.debug('Unable to load persisted user badges', err as Error);
    }

    return {
      ...profile.toObject(),
      phoneNumber: auth?.phoneNumber ?? null,
      email: auth?.email ?? null,
      role: auth?.role ?? null,
      emailVerified: Boolean(auth?.emailVerifiedAt),
      phoneVerified: Boolean(auth?.phoneVerifiedAt),
      contactVerified: Boolean(auth?.emailVerifiedAt || auth?.phoneVerifiedAt),
      verificationRequired: auth?.verificationRequired === true,
      totalXp: snapshot.totalXp,
      xp: snapshot.xp,
      level: snapshot.level,
      experienceLevel: snapshot.experienceLevel ?? ExperienceLevel.F,
      rankBadges: unlockedRankBadges,
      currentRankBadge,
      subRank: (profile as User & { subRank?: string }).subRank ?? null,
      nextRankProgress,
      // persisted awarded badges
      userBadges,
      badgeCount,
    };
  }
}
