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
  rankName: ExperienceLevel;
  requiredLevel: number;
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

  private parseRequiredLevel(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return null;
    }

    return parsed;
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
        const requiredLevel = this.parseRequiredLevel(item.value);
        const normalizedRankName = item.name?.trim().toLowerCase();

        if (
          !requiredLevel
          || !normalizedRankName
          || !this.isExperienceLevel(normalizedRankName)
        ) {
          return null;
        }

        return {
          rankName: normalizedRankName,
          requiredLevel,
        };
      })
      .filter((item): item is LevelUpRule => Boolean(item))
      .sort((first, second) => first.requiredLevel - second.requiredLevel);
  }

  private getRankForLevel(level: number, rules: LevelUpRule[]) {
    let promotedRank = ExperienceLevel.Beginner;

    for (const rule of rules) {
      if (level >= rule.requiredLevel) {
        promotedRank = rule.rankName;
      }
    }

    return promotedRank;
  }

  private async applyLevelProgression(profile: User, rules?: LevelUpRule[]) {
    const level = Math.max(1, Math.floor(Number(profile.level ?? 1)));
    const levelUpRules = rules ?? await this.getLevelUpRules();
    const promotedRank = this.getRankForLevel(level, levelUpRules);

    const shouldUpdate =
      profile.level !== level
      || (profile.experienceLevel ?? ExperienceLevel.Beginner) !== promotedRank;

    if (!shouldUpdate) {
      return profile;
    }

    const updated = await this.userModel.findByIdAndUpdate(
      profile._id,
      {
        level,
        experienceLevel: promotedRank,
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

    return {
      eventKey: normalizedEventKey,
      totalAwarded,
      currentXp: updatedProfile?.xp ?? (profile.xp + totalAwarded),
      appliedRules: updates.map((entry) => ({
        ruleCode: entry.ruleCode,
        ruleName: entry.ruleName,
        points: entry.points,
      })),
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
      experienceLevel: ExperienceLevel.Beginner,
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
      experienceLevel: profile.experienceLevel ?? ExperienceLevel.Beginner,
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
      experienceLevel: profile.experienceLevel ?? ExperienceLevel.Beginner,
    };
  }
}
