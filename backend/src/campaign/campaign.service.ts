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
import { ExtraService } from '../extra/extra.service';
import { ExtraCategory } from '../extra/constants/extra-category.enum';
import { CampaignApprovalStatus } from './schemas/campaign.schema';

@Injectable()
export class CampaignService {
  private static readonly INSTANT_CAMPAIGN_DURATION_MS = 12 * 60 * 60 * 1000;

  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Auth.name)
    private readonly authModel: Model<Auth>,
    private readonly audit: AuditService,
    private readonly userService: UserService,
    private readonly extraService: ExtraService,
  ) {}

  private generateCampaignCode() {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CMP-${suffix}`;
  }

  private getMinimumUserStartDate() {
    return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  }

  private getInstantCampaignEndDate(startDate: Date) {
    return new Date(startDate.getTime() + CampaignService.INSTANT_CAMPAIGN_DURATION_MS);
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

  private normalizeCampaignType(value?: string | null) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.toLowerCase();
    if (normalized !== 'solo' && normalized !== 'group') {
      throw new BadRequestException('hikeType must be either solo or group');
    }

    return normalized as 'solo' | 'group';
  }

  private async resolveCampaignCategory(value?: string | null) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('category is required');
    }

    const requested = value.trim();
    const response = await this.extraService.listExtras({
      category: ExtraCategory.Activities,
      page: 1,
      limit: 100,
    });

    const allowedActivities = response.items
      .filter((item) => item.enabled !== false)
      .map((item) => item.name.trim())
      .filter((name) => name.length > 0);

    const matched = allowedActivities.find(
      (name) => name.toLowerCase() === requested.toLowerCase(),
    );

    if (!matched) {
      throw new BadRequestException('Selected category is not enabled in admin extras');
    }

    return matched;
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

  private inferActivityTypeFromCampaign(payload: {
    title?: string | null;
    description?: string | null;
    placeName?: string | null;
  }) {
    const searchable = [payload.title, payload.description, payload.placeName]
      .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
      .filter(Boolean)
      .join(' ');

    if (!searchable) {
      return 'trek';
    }

    if (/(hike|hiking)/.test(searchable)) {
      return 'hike';
    }

    if (/(temple|heritage|monastery|stupa)/.test(searchable)) {
      return 'temple';
    }

    if (/(adventure|rafting|zipline|climb|paraglid|canyon)/.test(searchable)) {
      return 'adventure';
    }

    return 'trek';
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
      .select('_id title description placeName startDate endDate durationDays difficulty location district hostId participants')
      .lean();

    const toClose: Array<{
      _id: Types.ObjectId;
      endDate?: Date | null;
      title?: string | null;
      description?: string | null;
      placeName?: string | null;
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
          title: (campaign.title as string | null | undefined) ?? null,
          description: (campaign.description as string | null | undefined) ?? null,
          placeName: (campaign.placeName as string | null | undefined) ?? null,
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
      // mark campaigns as completed and open a 24h verification window for host
      const updates = toClose.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              completed: true,
              awaitingVerification: true,
              verificationDeadline: new Date(
                // set deadline to campaign end time + 24 hours
                (item.endDate ? new Date(item.endDate).getTime() : Date.now()) + 24 * 60 * 60 * 1000,
              ),
            },
          },
        },
      }));

      await this.campaignModel.bulkWrite(updates);

      for (const campaign of toClose) {
        await this.audit.logEvent({
          type: 'campaign.auto_complete',
          campaignId: campaign._id.toString(),
          hostId: campaign.hostId.toString(),
        });
      }
    }
  }

  private async processVerificationDeadlines() {
    const now = new Date();
    const expired = await this.campaignModel.find({
      awaitingVerification: true,
      verificationDeadline: { $ne: null, $lte: now },
      deletedByAdmin: false,
    }).lean();

    if (expired.length === 0) return;

    const ids = expired.map((c) => c._id);
    await this.campaignModel.updateMany(
      { _id: { $in: ids } },
      { $set: { failed: true, awaitingVerification: false, failedAt: new Date() } },
    );

    for (const campaign of expired) {
      await this.audit.logEvent({
        type: 'campaign.verification_failed',
        campaignId: campaign._id.toString(),
        hostId: (campaign.hostId as Types.ObjectId).toString(),
      });
    }
  }

  // public wrapper for scheduled jobs
  async runVerificationHousekeeping() {
    await this.autoCloseExpiredCampaigns();
    await this.processVerificationDeadlines();
  }

  async verifyCampaignCompletion(id: string, requesterId: string, photo?: { url: string; publicId?: string | null; caption?: string | null }) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) throw new NotFoundException('Campaign not found');

    if (campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Only the host can verify campaign completion');
    }

    if (!campaign.completed || !campaign.awaitingVerification) {
      throw new BadRequestException('Campaign is not awaiting verification');
    }

    const now = new Date();
    if (!campaign.verificationDeadline || now.getTime() > new Date(campaign.verificationDeadline).getTime()) {
      throw new BadRequestException('Verification window has expired');
    }

    if (photo && photo.url) {
      campaign.verificationPhotos = campaign.verificationPhotos || [];
      campaign.verificationPhotos.push({
        url: photo.url,
        publicId: photo.publicId ?? null,
        caption: photo.caption ?? null,
      } as any);
    }

    campaign.hostVerified = true;
    campaign.verifiedAt = new Date();
    campaign.awaitingVerification = false;

    await campaign.save();

    // award xp now (host + participants)
    const campaignId = campaign._id.toString();
    const normalizedDifficulty = (campaign.difficulty as string | undefined)?.trim().toLowerCase();
    const normalizedDistrict = (campaign.district as string | undefined)?.trim().toLowerCase()
      ?? (campaign.location as string | undefined)?.trim().toLowerCase();
    const locationKey = ((campaign.placeName as string | undefined) ?? (campaign.location as string | undefined) ?? (campaign.district as string | undefined) ?? '')
      .trim()
      .toLowerCase();
    const activityType = this.inferActivityTypeFromCampaign(campaign as any);
    const acceptedParticipants = (campaign.participants ?? []).filter(
      (participant) => (participant as any).status === 'accepted',
    );
    const participantCount = acceptedParticipants.length;

    await this.userService.awardXpForEvent(
      campaign.hostId.toString(),
      'host_campaign_completed',
      {
        campaignId,
        difficulty: normalizedDifficulty,
        district: normalizedDistrict,
        locationKey,
        activityType,
        hostOnly: true,
      },
    );

    for (const participant of acceptedParticipants) {
      await this.userService.awardXpForEvent(
        (participant as any).userId.toString(),
        'campaign_completed',
        {
          campaignId,
          difficulty: normalizedDifficulty,
          district: normalizedDistrict,
          locationKey,
          activityType,
          solo: participantCount <= 1,
          hostOnly: false,
        },
      );

      await this.userService.recordAchievementEvent(
        (participant as any).userId.toString(),
        {
          subcategory: this.getCampaignCompletionSubcategory(campaign.difficulty),
          count: 1,
        },
      );

      await this.userService.awardXpForEvent(
        (participant as any).userId.toString(),
        'first_trek_new_district',
        {
          campaignId,
          difficulty: normalizedDifficulty,
          district: normalizedDistrict,
          locationKey,
          activityType,
          solo: participantCount <= 1,
        },
      );

      await this.userService.applyReferralCompletionAwardForUser(
        (participant as any).userId.toString(),
      );
    }

    await this.audit.logEvent({ type: 'campaign.verified_completion', campaignId, hostId: requesterId });

    return this.getCampaignById(id);
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

  private canUserEditCampaign(status?: CampaignApprovalStatus | null) {
    return status === 'draft' || status === 'rejected';
  }

  private async getDifficultyApprovalRequirement(difficulty?: string | null): Promise<boolean> {
    if (!difficulty || !difficulty.trim()) {
      return false;
    }

    const difficultyItems = await this.extraService.listExtras({
      category: ExtraCategory.Difficulty,
      page: 1,
      limit: 100,
    });

    const matched = difficultyItems.items.find(
      (item) => item.name.toLowerCase() === difficulty.trim().toLowerCase(),
    );

    return matched?.adminApprovalRequired ?? false;
  }

  async createCampaign(dto: CreateCampaignDto, hostId: string, isAdmin = false) {
    const campaignCode = await this.createUniqueCampaignCode();
    const scheduleType = dto.scheduleType ?? 'scheduled';
    const category = await this.resolveCampaignCategory(dto.category);
    const hikeType = this.normalizeCampaignType(dto.hikeType);

    if (!hikeType) {
      throw new BadRequestException('hikeType is required');
    }

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

    const resolvedEndDate = scheduleType === 'instant'
      ? this.getInstantCampaignEndDate(startDate)
      : endDate;

    if (!isAdmin && startDate && startDate.getTime() < this.getMinimumUserStartDate().getTime()) {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    this.validateTiming(startDate, resolvedEndDate, joinOpenDate);

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      category: _category,
      hikeType: _hikeType,
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

    const difficultyRequiresApproval = !isAdmin && await this.getDifficultyApprovalRequirement(dto.difficulty);
    const approvalStatus: CampaignApprovalStatus = isAdmin ? 'approved' : (difficultyRequiresApproval ? 'draft' : 'approved');

    const created = await this.campaignModel.create({
      campaignCode,
      ...rest,
      category,
      hikeType,
      location: normalizedLocation,
      province: normalizedProvince,
      district: normalizedDistrict,
      placeName: normalizedPlaceName,
      scheduleType,
      startDate,
      endDate: resolvedEndDate,
      joinOpenDate,
      hostId: new Types.ObjectId(hostId),
      approvalStatus,
      submittedAt: isAdmin ? new Date() : null,
      approvedAt: isAdmin ? new Date() : null,
      approvedBy: isAdmin ? new Types.ObjectId(hostId) : null,
      rejectedAt: null,
      rejectedBy: null,
      approvalNote: null,
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
    await this.processVerificationDeadlines();

    const skip = (page - 1) * limit;
    const now = new Date();
    const filter: Record<string, unknown> = {
      deletedByAdmin: false,
    };

    if (!includeFuture) {
      filter.$and = [
        {
          approvalStatus: 'approved',
        },
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
    await this.processVerificationDeadlines();

    const item = await this.campaignModel.findById(id).lean();
    if (!item || item.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    const [enriched] = await this.enrichWithCreator([item as Record<string, any>]);
    return enriched;
  }

  async joinCampaign(id: string, userId: string) {
    await this.autoCloseExpiredCampaigns();
    await this.processVerificationDeadlines();

    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.approvalStatus !== 'approved') {
      throw new BadRequestException('Only approved campaigns can be joined');
    }

    if (campaign.completed || campaign.failed || campaign.awaitingVerification) {
      throw new BadRequestException('Campaign is closed');
    }

    const now = new Date();
    if (campaign.joinOpenDate && campaign.joinOpenDate.getTime() > now.getTime()) {
      throw new BadRequestException('Campaign is not open for enrollment yet');
    }

    if (campaign.endDate && campaign.endDate.getTime() <= now.getTime()) {
      throw new BadRequestException('Campaign enrollment is closed');
    }

    if (campaign.hostId.toString() === userId) {
      throw new BadRequestException('Host cannot enroll in their own campaign');
    }

    const participants = campaign.participants ?? [];
    const existingParticipant = participants.find(
      (participant) => participant.userId.toString() === userId,
    );

    if (existingParticipant?.status === 'accepted') {
      throw new BadRequestException('You are already enrolled in this campaign');
    }

    if (existingParticipant?.status === 'pending') {
      throw new BadRequestException('Your request is already pending for this campaign');
    }

    const acceptedCount = participants.filter(
      (participant) => participant.status === 'accepted',
    ).length;

    const maxParticipants = Math.max(1, Number(campaign.maxParticipants ?? 1));
    if (acceptedCount >= maxParticipants) {
      throw new BadRequestException('Campaign is full');
    }

    const nextStatus = campaign.joinMode === 'open' ? 'accepted' : 'pending';

    if (existingParticipant) {
      existingParticipant.status = nextStatus;
      existingParticipant.verified = false;
      existingParticipant.completionDays = null;
    } else {
      participants.push({
        userId: new Types.ObjectId(userId),
        status: nextStatus,
        verified: false,
        completionDays: null,
      });
    }

    campaign.participants = participants;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.join',
      campaignId: id,
      userId,
      status: nextStatus,
      joinMode: campaign.joinMode,
    });

    return {
      message: nextStatus === 'accepted'
        ? 'Successfully enrolled in campaign'
        : 'Campaign join request submitted',
      campaign: await this.getCampaignById(id),
    };
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

    if (campaign.failed && !isAdmin) {
      throw new ForbiddenException('Failed campaigns cannot be edited');
    }

    if (!isAdmin && !this.canUserEditCampaign(campaign.approvalStatus)) {
      throw new ForbiddenException('Only draft or rejected campaigns can be edited by users');
    }

    const nextScheduleType = dto.scheduleType ?? campaign.scheduleType ?? 'scheduled';
    const nextCategory = dto.category !== undefined
      ? await this.resolveCampaignCategory(dto.category)
      : (campaign.category ?? null);
    const nextHikeType = dto.hikeType !== undefined
      ? (() => {
        const normalizedHikeType = this.normalizeCampaignType(dto.hikeType);

        if (!normalizedHikeType) {
          throw new BadRequestException('hikeType is required');
        }

        return normalizedHikeType;
      })()
      : (campaign.hikeType ?? 'group');

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

    const resolvedEndDate = nextScheduleType === 'instant'
      ? this.getInstantCampaignEndDate(nextStartDate)
      : nextEndDate;

    if (!isAdmin && nextStartDate && nextStartDate.getTime() < this.getMinimumUserStartDate().getTime()) {
      throw new BadRequestException('User campaigns must be scheduled at least 2 days in advance');
    }

    this.validateTiming(nextStartDate, resolvedEndDate, nextJoinOpenDate);

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      category: _category,
      hikeType: _hikeType,
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
    campaign.category = nextCategory ?? campaign.category;
    campaign.hikeType = nextHikeType;
    campaign.scheduleType = nextScheduleType;
    campaign.startDate = nextStartDate;
    campaign.endDate = resolvedEndDate;
    campaign.joinOpenDate = nextJoinOpenDate;

    if (!isAdmin) {
      campaign.approvalStatus = 'draft';
      campaign.submittedAt = null;
      campaign.approvedAt = null;
      campaign.approvedBy = null;
      campaign.rejectedAt = null;
      campaign.rejectedBy = null;
      campaign.approvalNote = null;
    }

    await campaign.save();
    await this.audit.logEvent({
      type: 'campaign.update',
      campaignId: id,
      requesterId,
    });
    return this.getCampaignById(id);
  }

  async submitCampaign(id: string, requesterId: string, isAdmin = false) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    if (!isAdmin && campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Not allowed to submit this campaign');
    }

    if (campaign.completed) {
      throw new BadRequestException('Completed campaigns cannot be submitted for review');
    }

    if (campaign.approvalStatus === 'approved') {
      throw new BadRequestException('Campaign is already approved');
    }

    if (campaign.approvalStatus === 'submitted') {
      throw new BadRequestException('Campaign is already submitted for review');
    }

    campaign.approvalStatus = 'submitted';
    campaign.submittedAt = new Date();
    campaign.approvedAt = null;
    campaign.approvedBy = null;
    campaign.rejectedAt = null;
    campaign.rejectedBy = null;
    campaign.approvalNote = null;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.submit',
      campaignId: id,
      requesterId,
    });

    return this.getCampaignById(id);
  }

  async approveCampaign(id: string, adminId: string, note?: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.approvalStatus !== 'submitted') {
      throw new BadRequestException('Only submitted campaigns can be approved');
    }

    campaign.approvalStatus = 'approved';
    campaign.approvedAt = new Date();
    campaign.approvedBy = new Types.ObjectId(adminId);
    campaign.rejectedAt = null;
    campaign.rejectedBy = null;
    campaign.approvalNote = note?.trim() || null;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.approve',
      campaignId: id,
      adminId,
      note: note?.trim() || null,
    });

    return this.getCampaignById(id);
  }

  async rejectCampaign(id: string, adminId: string, reason: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    const normalizedReason = reason?.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Reject reason is required');
    }

    if (campaign.approvalStatus !== 'submitted') {
      throw new BadRequestException('Only submitted campaigns can be rejected');
    }

    campaign.approvalStatus = 'rejected';
    campaign.rejectedAt = new Date();
    campaign.rejectedBy = new Types.ObjectId(adminId);
    campaign.approvedAt = null;
    campaign.approvedBy = null;
    campaign.approvalNote = normalizedReason;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.reject',
      campaignId: id,
      adminId,
      reason: normalizedReason,
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
