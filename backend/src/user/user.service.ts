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
  rankName: string;
  requiredLevel: number;
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

        if (!requiredLevel || !item.name?.trim()) {
          return null;
        }

        return {
          rankName: item.name.trim(),
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
