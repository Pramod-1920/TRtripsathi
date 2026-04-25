import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import { Campaign, CampaignDocument } from './schemas/campaign.schema';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuditService } from '../audit/audit.service';
import { User } from '../user/schemas/user.schema';
import { Auth } from '../auth/schemas/auth.schema';
import { UserService } from '../user/user.service';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Auth.name)
    private readonly authModel: Model<Auth>,
    private readonly audit: AuditService,
    private readonly userService: UserService,
  ) {}

  private generateCampaignCode() {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CMP-${suffix}`;
  }

  private getMinimumUserStartDate() {
    return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  }

  private normalizeLocationPart(value?: string | null) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private buildDisplayLocation(
    province?: string | null,
    district?: string | null,
    placeName?: string | null,
  ) {
    const parts = [
      this.normalizeLocationPart(province),
      this.normalizeLocationPart(district),
      this.normalizeLocationPart(placeName),
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? parts.join(', ') : null;
  }

    private parseDateValue(value?: string | Date | null): Date | null {
      if (value === undefined || value === null || value === '') {
        return null;
      }

      const parsed = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid date/time value in campaign payload');
      }

      return parsed;
    }

    private validateTiming(
      startDate: Date | null,
      endDate: Date | null,
      joinOpenDate: Date | null,
    ) {
      if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
        throw new BadRequestException('endDate must be later than startDate');
      }

      if (joinOpenDate && startDate && joinOpenDate.getTime() > startDate.getTime()) {
        throw new BadRequestException('joinOpenDate must be before or equal to startDate');
      }

      if (joinOpenDate && endDate && joinOpenDate.getTime() > endDate.getTime()) {
        throw new BadRequestException('joinOpenDate must be before endDate');
      }
    }

  private getCampaignCompletionSubcategory(difficulty?: string | null) {
    const normalizedDifficulty = difficulty?.trim().toLowerCase();

    if (normalizedDifficulty === 'easy') {
      return 'hikes';
    }

    if (normalizedDifficulty === 'hard') {
      return 'difficult_routes';
    }

    if (normalizedDifficulty === 'extreme') {
      return 'legendary_routes';
    }

    return 'treks';
  }

  private async createUniqueCampaignCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateCampaignCode();
      const existing = await this.campaignModel.findOne({ campaignCode: code }).lean();

      if (!existing) {
        return code;
      }
    }

    throw new Error('Unable to generate unique campaign code');
  }

  private async autoCloseExpiredCampaigns() {
    const now = new Date();
    const candidates = await this.campaignModel
      .find({
        deletedByAdmin: false,
        completed: false,
        startDate: { $ne: null },
      })
      .select('_id startDate endDate durationDays difficulty location district hostId participants')
      .lean();

    const toClose: Array<{
      _id: Types.ObjectId;
      endDate?: Date | null;
      difficulty?: string | null;
      location?: string | null;
      district?: string | null;
      hostId: Types.ObjectId;
      participants?: Array<{ userId: Types.ObjectId; status?: string }>;
    }> = [];

    for (const campaign of candidates) {
      if (!campaign.startDate) {
        continue;
      }

      const startTime = new Date(campaign.startDate).getTime();
      const explicitEndTime = campaign.endDate
        ? new Date(campaign.endDate).getTime()
        : Number.NaN;
      const durationDays = Math.max(1, Number(campaign.durationDays ?? 1));
      const endTime = Number.isFinite(explicitEndTime)
        ? explicitEndTime
        : startTime + durationDays * 24 * 60 * 60 * 1000;

      if (now.getTime() >= endTime) {
        toClose.push({
          _id: campaign._id as Types.ObjectId,
          endDate: (campaign.endDate as Date | null | undefined) ?? null,
          difficulty: campaign.difficulty,
          location: campaign.location,
          district: (campaign.district as string | null | undefined) ?? null,
          hostId: campaign.hostId as Types.ObjectId,
          participants: (campaign.participants ?? []) as Array<{
            userId: Types.ObjectId;
            status?: string;
          }>,
        });
      }
    }

    if (toClose.length > 0) {
      await this.campaignModel.updateMany(
        { _id: { $in: toClose.map((item) => item._id) } },
        { $set: { completed: true } },
      );

      for (const campaign of toClose) {
        const campaignId = campaign._id.toString();
        const normalizedDifficulty = campaign.difficulty?.trim().toLowerCase();
        const normalizedDistrict = campaign.district?.trim().toLowerCase()
          ?? campaign.location?.trim().toLowerCase();
        const acceptedParticipants = (campaign.participants ?? []).filter(
          (participant) => participant.status === 'accepted',
        );
        const participantCount = acceptedParticipants.length;

        await this.userService.awardXpForEvent(
          campaign.hostId.toString(),
          'host_campaign_completed',
          {
            campaignId,
            difficulty: normalizedDifficulty,
            district: normalizedDistrict,
            hostOnly: true,
          },
        );

        for (const participant of acceptedParticipants) {
          await this.userService.awardXpForEvent(
            participant.userId.toString(),
            'campaign_completed',
            {
              campaignId,
              difficulty: normalizedDifficulty,
              district: normalizedDistrict,
              solo: participantCount <= 1,
              hostOnly: false,
            },
          );

          await this.userService.recordAchievementEvent(
            participant.userId.toString(),
            {
              subcategory: this.getCampaignCompletionSubcategory(campaign.difficulty),
              count: 1,
            },
          );

          await this.userService.awardXpForEvent(
            participant.userId.toString(),
            'first_trek_new_district',
            {
              campaignId,
              difficulty: normalizedDifficulty,
              district: normalizedDistrict,
              solo: participantCount <= 1,
            },
          );

          await this.userService.applyReferralCompletionAwardForUser(
            participant.userId.toString(),
          );
        }
      }
    }
  }

  private buildCreatorName(profile?: Partial<User> | null, fallback?: string) {
    if (!profile) {
      return fallback ?? 'Unknown';
    }

    const fullName = [profile.firstName, profile.middleName, profile.lastName]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();

    return fullName || fallback || 'Unknown';
  }

  private async enrichWithCreator(items: Array<Record<string, any>>) {
    if (items.length === 0) {
      return items;
    }

    const hostIds = Array.from(
      new Set(
        items
          .map((item) => String(item.hostId ?? ''))
          .filter((id) => id.length > 0),
      ),
    );

    if (hostIds.length === 0) {
      return items;
    }

    const objectIds = hostIds.map((id) => new Types.ObjectId(id));

    const [hosts, profiles] = await Promise.all([
      this.authModel
        .find({ _id: { $in: objectIds } })
        .select('_id phoneNumber role')
        .lean(),
      this.userModel
        .find({ authId: { $in: objectIds } })
        .select('authId firstName middleName lastName')
        .lean(),
    ]);

    const hostMap = new Map(hosts.map((host) => [String(host._id), host]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.authId), profile]),
    );

    return items.map((item) => {
      const hostId = String(item.hostId ?? '');
      const host = hostMap.get(hostId);
      const profile = profileMap.get(hostId);
      const phoneNumber = host?.phoneNumber ?? null;

      return {
        ...item,
        creator: {
          name: this.buildCreatorName(profile as Partial<User>, phoneNumber ?? 'Unknown'),
          role: host?.role ?? 'user',
          phoneNumber,
        },
      };
    });
  }

  async createCampaign(dto: CreateCampaignDto, hostId: string, isAdmin = false) {
    const campaignCode = await this.createUniqueCampaignCode();
    const scheduleType = dto.scheduleType ?? 'scheduled';

    if (!isAdmin && scheduleType === 'instant') {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    let startDate = this.parseDateValue(dto.startDate);
    let joinOpenDate = dto.joinOpenDate !== undefined
      ? this.parseDateValue(dto.joinOpenDate)
      : null;
    const endDate = this.parseDateValue(dto.endDate);

    if (scheduleType === 'instant') {
      const now = new Date();
      startDate ??= now;
      joinOpenDate ??= startDate;
    } else {
      if (!startDate) {
        throw new BadRequestException('startDate is required for scheduled campaigns');
      }

      joinOpenDate ??= startDate;
    }

    if (!isAdmin && startDate && startDate.getTime() < this.getMinimumUserStartDate().getTime()) {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    this.validateTiming(startDate, endDate, joinOpenDate);

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      province,
      district,
      placeName,
      location,
      ...rest
    } = dto;

    const normalizedProvince = this.normalizeLocationPart(province);
    const normalizedDistrict = this.normalizeLocationPart(district);
    const normalizedPlaceName = this.normalizeLocationPart(placeName);
    const normalizedLocation = this.normalizeLocationPart(location)
      ?? this.buildDisplayLocation(normalizedProvince, normalizedDistrict, normalizedPlaceName);

    const created = await this.campaignModel.create({
      campaignCode,
      ...rest,
      location: normalizedLocation,
      province: normalizedProvince,
      district: normalizedDistrict,
      placeName: normalizedPlaceName,
      scheduleType,
      startDate,
      endDate,
      joinOpenDate,
      hostId: new Types.ObjectId(hostId),
    });
    await this.audit.logEvent({
      type: 'campaign.create',
      campaignId: created._id.toString(),
      hostId,
    });
    return this.getCampaignById(created._id.toString());
  }

  async listCampaigns(page = 1, limit = 20, includeFuture = false) {
    await this.autoCloseExpiredCampaigns();

    const skip = (page - 1) * limit;
    const now = new Date();
    const filter: Record<string, unknown> = {
      deletedByAdmin: false,
    };

    if (!includeFuture) {
      filter.$and = [
        {
          $or: [
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { joinOpenDate: null },
            { joinOpenDate: { $lte: now } },
          ],
        },
      ];
    }

    const rawItems = await this.campaignModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .lean();
    const items = await this.enrichWithCreator(rawItems as Array<Record<string, any>>);
    const total = await this.campaignModel.countDocuments(filter);
    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCampaignById(id: string) {
    await this.autoCloseExpiredCampaigns();

    const item = await this.campaignModel.findById(id).lean();
    if (!item || item.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    const [enriched] = await this.enrichWithCreator([item as Record<string, any>]);
    return enriched;
  }

  async updateCampaign(
    id: string,
    dto: UpdateCampaignDto,
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    if (!isAdmin && campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Not allowed to edit this campaign');
    }

    const nextScheduleType = dto.scheduleType ?? campaign.scheduleType ?? 'scheduled';

    if (!isAdmin && nextScheduleType === 'instant') {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    let nextStartDate = dto.startDate !== undefined
      ? this.parseDateValue(dto.startDate)
      : (campaign.startDate ?? null);
    let nextJoinOpenDate = dto.joinOpenDate !== undefined
      ? this.parseDateValue(dto.joinOpenDate)
      : (campaign.joinOpenDate ?? null);
    const nextEndDate = dto.endDate !== undefined
      ? this.parseDateValue(dto.endDate)
      : (campaign.endDate ?? null);

    if (nextScheduleType === 'instant') {
      nextStartDate ??= new Date();
      nextJoinOpenDate ??= nextStartDate;
    } else {
      if (!nextStartDate) {
        throw new BadRequestException('startDate is required for scheduled campaigns');
      }

      nextJoinOpenDate ??= nextStartDate;
    }

    if (!isAdmin && nextStartDate && nextStartDate.getTime() < this.getMinimumUserStartDate().getTime()) {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    this.validateTiming(nextStartDate, nextEndDate, nextJoinOpenDate);

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      province,
      district,
      placeName,
      location,
      ...rest
    } = dto;

    const nextProvince = dto.province !== undefined
      ? this.normalizeLocationPart(province)
      : this.normalizeLocationPart(campaign.province ?? null);
    const nextDistrict = dto.district !== undefined
      ? this.normalizeLocationPart(district)
      : this.normalizeLocationPart(campaign.district ?? null);
    const nextPlaceName = dto.placeName !== undefined
      ? this.normalizeLocationPart(placeName)
      : this.normalizeLocationPart(campaign.placeName ?? null);

    const nextLocation = dto.location !== undefined
      ? (this.normalizeLocationPart(location)
        ?? this.buildDisplayLocation(nextProvince, nextDistrict, nextPlaceName))
      : (this.normalizeLocationPart(campaign.location ?? null)
        ?? this.buildDisplayLocation(nextProvince, nextDistrict, nextPlaceName));

    Object.assign(campaign, rest);
    campaign.location = nextLocation;
    campaign.province = nextProvince;
    campaign.district = nextDistrict;
    campaign.placeName = nextPlaceName;
    campaign.scheduleType = nextScheduleType;
    campaign.startDate = nextStartDate;
    campaign.endDate = nextEndDate;
    campaign.joinOpenDate = nextJoinOpenDate;

    await campaign.save();
    await this.audit.logEvent({
      type: 'campaign.update',
      campaignId: id,
      requesterId,
    });
    return this.getCampaignById(id);
  }

  async adminDeleteCampaign(
    id: string,
    adminId: string,
    reason?: string,
    userModel?: Model<any>,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new NotFoundException('Campaign not found');

    campaign.deletedByAdmin = true;
    await campaign.save();

    // mark host profile with admin flag if userModel provided
    try {
      if (userModel) {
        await userModel.findOneAndUpdate(
          { authId: campaign.hostId },
          {
            $push: {
              adminFlags: {
                type: 'campaign_deleted',
                campaignId: campaign._id.toString(),
                reason,
                date: new Date(),
              },
            },
          },
        );
      }
    } catch (error) {
      // best-effort: log to console for visibility
      // avoid failing admin delete if host update fails

      console.warn(
        'Failed to mark host adminFlags for deleted campaign',
        error,
      );
    }

    await this.audit.logEvent({
      type: 'campaign.delete_by_admin',
      campaignId: id,
      adminId,
      reason,
    });
    return { message: 'Campaign deleted by admin' };
  }

  async hardDeleteCampaign(id: string) {
    // permanently remove
    await this.campaignModel.findByIdAndDelete(id);
    await this.audit.logEvent({ type: 'campaign.hard_delete', campaignId: id });
    return { message: 'Campaign permanently removed' };
  }
}
