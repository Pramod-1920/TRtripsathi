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
import { CampaignApprovalStatus } from './schemas/campaign.schema';
import { CampaignLifecyclePhase } from './schemas/campaign.schema';
import { NotificationService } from '../notification/notification.service';
import { VisitedPlaceService } from '../visited-place/visited-place.service';
import {
  AddTaskDto,
  UpdatePlanningDto,
  UpdateTaskDto,
} from './dto/lifecycle.dto';

@Injectable()
export class CampaignService {
  private static readonly INSTANT_CAMPAIGN_DURATION_MS = 12 * 60 * 60 * 1000;
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly HOST_INACTIVITY_LIMIT_MS = 48 * 60 * 60 * 1000;
  private static readonly MAX_HOST_INACTIVITY_REMINDERS = 2;
  private static readonly VALID_PHASE_TRANSITIONS: Record<
    CampaignLifecyclePhase,
    CampaignLifecyclePhase[]
  > = {
    draft: ['open', 'cancelled'],
    open: ['planning', 'cancelled'],
    planning: ['verification', 'cancelled'],
    verification: ['ready', 'planning', 'cancelled'],
    ready: ['started', 'cancelled'],
    started: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

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
    private readonly notificationService: NotificationService,
    private readonly visitedPlaceService: VisitedPlaceService,
  ) {}

  private async recordVerifiedCampaignVisits(
    authIds: string[],
    campaign: CampaignDocument,
  ) {
    const validAuthIds = Array.from(new Set(authIds))
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validAuthIds.length === 0) return;

    const profiles = await this.userModel
      .find({ authId: { $in: validAuthIds } })
      .select('_id');
    const district = String(campaign.district ?? '').trim();
    const province = String(campaign.province ?? '').trim();
    const visitedAt = campaign.verifiedAt ?? new Date();

    await Promise.all(
      profiles.flatMap((profile) => [
        ...(district
          ? [
              this.visitedPlaceService.recordVisit(
                String(profile._id),
                district,
                'district',
                visitedAt,
                String(campaign._id),
              ),
            ]
          : []),
        ...(province
          ? [
              this.visitedPlaceService.recordVisit(
                String(profile._id),
                province,
                'province',
                visitedAt,
                String(campaign._id),
              ),
            ]
          : []),
      ]),
    );
  }

  private getMinimumUserStartDate(hikeType: 'solo' | 'group' = 'solo') {
    const leadDays = hikeType === 'group' ? 9 : 2;
    return new Date(Date.now() + leadDays * CampaignService.DAY_MS);
  }

  private getCampaignEndTime(candidate: {
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    durationDays?: number | null;
  }) {
    if (!candidate.startDate) {
      return Number.NaN;
    }
    const startTime = new Date(candidate.startDate).getTime();
    if (!Number.isFinite(startTime)) {
      return Number.NaN;
    }
    const explicitEnd = candidate.endDate
      ? new Date(candidate.endDate).getTime()
      : Number.NaN;
    if (Number.isFinite(explicitEnd)) {
      return explicitEnd;
    }
    const durationDays = Math.max(1, Number(candidate.durationDays ?? 1));
    return startTime + durationDays * CampaignService.DAY_MS;
  }

  private countAcceptedParticipants(campaign: any) {
    return (campaign.participants ?? []).filter(
      (participant: any) => participant.status === 'accepted',
    ).length;
  }

  private countConfirmedParticipants(campaign: any) {
    return (campaign.participants ?? []).filter(
      (participant: any) =>
        participant.status === 'accepted' && participant.confirmed === true,
    ).length;
  }

  private ensureValidPhaseTransition(
    from: CampaignLifecyclePhase,
    to: CampaignLifecyclePhase,
  ) {
    const allowed = CampaignService.VALID_PHASE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid phase transition: ${from} -> ${to}`,
      );
    }
  }

  private calculateGroupTimeline(startDate: Date, createdAt = new Date()) {
    const totalAvailableDays =
      Math.floor(
        (startDate.getTime() - createdAt.getTime()) / CampaignService.DAY_MS,
      ) - 1;

    if (totalAvailableDays < 3) {
      throw new BadRequestException(
        'Group campaign requires at least 3 lifecycle days before the rest day',
      );
    }

    const openDays = Math.max(1, Math.floor(totalAvailableDays * 0.33));
    const planningDays = Math.max(1, Math.floor(totalAvailableDays * 0.33));
    const verificationDays = Math.max(
      1,
      totalAvailableDays - openDays - planningDays,
    );

    const openAt = new Date(createdAt);
    const planningAt = new Date(
      openAt.getTime() + openDays * CampaignService.DAY_MS,
    );
    const verificationAt = new Date(
      planningAt.getTime() + planningDays * CampaignService.DAY_MS,
    );
    const readyAt = new Date(startDate.getTime() - CampaignService.DAY_MS);

    if (verificationAt.getTime() > readyAt.getTime()) {
      throw new BadRequestException(
        'Group campaign timeline is too short for open/planning/verification phases',
      );
    }

    return {
      createdAt,
      openAt,
      planningAt,
      verificationAt,
      readyAt,
      nextTransitionAt: planningAt,
      split: {
        totalAvailableDays,
        openDays,
        planningDays,
        verificationDays,
      },
    };
  }

  private getDefaultPlanningState() {
    return {
      transportDecision: null,
      meetingPoint: null,
      meetingTime: null,
      costBreakdown: {
        transport: 0,
        food: 0,
        guide: 0,
        misc: 0,
        totalCost: 0,
        costPerPerson: 0,
      },
      tasks: [],
      isComplete: false,
      completenessErrors: [],
      lastUpdatedAt: null,
    };
  }

  private recomputePlanningCost(campaign: any) {
    campaign.planning = campaign.planning ?? this.getDefaultPlanningState();
    campaign.planning.costBreakdown = campaign.planning.costBreakdown ?? {
      transport: 0,
      food: 0,
      guide: 0,
      misc: 0,
      totalCost: 0,
      costPerPerson: 0,
    };

    const transport = Math.max(
      0,
      Number(campaign.planning.costBreakdown.transport ?? 0),
    );
    const food = Math.max(0, Number(campaign.planning.costBreakdown.food ?? 0));
    const guide = Math.max(
      0,
      Number(campaign.planning.costBreakdown.guide ?? 0),
    );
    const misc = Math.max(0, Number(campaign.planning.costBreakdown.misc ?? 0));
    const totalCost = transport + food + guide + misc;
    const activeParticipants = Math.max(
      1,
      this.countAcceptedParticipants(campaign),
    );

    campaign.planning.costBreakdown.transport = transport;
    campaign.planning.costBreakdown.food = food;
    campaign.planning.costBreakdown.guide = guide;
    campaign.planning.costBreakdown.misc = misc;
    campaign.planning.costBreakdown.totalCost = totalCost;
    campaign.planning.costBreakdown.costPerPerson = Number(
      (totalCost / activeParticipants).toFixed(2),
    );
  }

  private evaluatePlanningCompleteness(campaign: any) {
    campaign.planning = campaign.planning ?? this.getDefaultPlanningState();
    const missing: string[] = [];

    if (
      !campaign.planning.transportDecision ||
      !String(campaign.planning.transportDecision).trim()
    ) {
      missing.push('transportDecision');
    }

    if (
      !campaign.planning.meetingPoint ||
      !String(campaign.planning.meetingPoint).trim()
    ) {
      missing.push('meetingPoint');
    }

    if (!campaign.planning.meetingTime) {
      missing.push('meetingTime');
    }

    const costBreakdown = campaign.planning.costBreakdown ?? {};
    const costFields: Array<'transport' | 'food' | 'guide' | 'misc'> = [
      'transport',
      'food',
      'guide',
      'misc',
    ];
    for (const field of costFields) {
      const value = Number(costBreakdown[field]);
      if (!Number.isFinite(value) || value < 0) {
        missing.push(`costBreakdown.${field}`);
      }
    }

    const tasks = campaign.planning.tasks ?? [];
    if (tasks.length === 0) {
      missing.push('tasks');
    } else {
      const hasUnassigned = tasks.some((task: any) => !task.assignedUserId);
      if (hasUnassigned) {
        missing.push('tasks.assignedUserId');
      }
    }

    campaign.planning.completenessErrors = missing;
    campaign.planning.isComplete = missing.length === 0;
    campaign.planning.lastUpdatedAt = new Date();
  }

  private async notifyParticipants(
    campaign: any,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const recipientIds = new Set<string>();
    recipientIds.add(campaign.hostId.toString());
    for (const participant of campaign.participants ?? []) {
      if (participant.status === 'accepted') {
        recipientIds.add(participant.userId.toString());
      }
    }
    if (recipientIds.size === 0) {
      return;
    }
    await this.notificationService.createBulkNotifications(
      Array.from(recipientIds),
      'admin_message',
      title,
      body,
      data ?? {},
    );
  }

  private generateCampaignCode() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(6);
    let suffix = '';
    for (const byte of bytes) {
      suffix += alphabet[byte % alphabet.length];
    }
    return `#${suffix}`;
  }

  private normalizeCampaignCode(value: string) {
    const normalized = value.trim().toUpperCase();
    const withPrefix = normalized.startsWith('#')
      ? normalized
      : `#${normalized}`;
    if (!/^#[A-Z0-9]{6}$/.test(withPrefix)) {
      throw new BadRequestException(
        'Campaign code must contain # followed by 6 letters or numbers',
      );
    }
    return withPrefix;
  }

  private getInstantCampaignEndDate(startDate: Date) {
    return new Date(
      startDate.getTime() + CampaignService.INSTANT_CAMPAIGN_DURATION_MS,
    );
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
    municipality?: string | null,
    placeName?: string | null,
  ) {
    const parts = [
      this.normalizeLocationPart(province),
      this.normalizeLocationPart(district),
      this.normalizeLocationPart(municipality),
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

    return normalized;
  }

  private async resolveCampaignActivity(
    value?: string | null,
    subcategory?: string | null,
  ) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('category is required');
    }

    return this.extraService.resolveActivitySelection(
      value.trim(),
      subcategory,
    );
  }

  private parseDateValue(value?: string | Date | null): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Invalid date/time value in campaign payload',
      );
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

    if (
      joinOpenDate &&
      startDate &&
      joinOpenDate.getTime() > startDate.getTime()
    ) {
      throw new BadRequestException(
        'joinOpenDate must be before or equal to startDate',
      );
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
      .map((value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : '',
      )
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
      const existing = await this.campaignModel
        .findOne({ campaignCode: code })
        .lean();

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
        approvalStatus: 'approved',
        startDate: { $ne: null },
      })
      .select(
        '_id title description placeName startDate endDate durationDays difficulty location district hostId participants',
      )
      .lean();

    const toClose: Array<{
      _id: Types.ObjectId;
      endTime: number;
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
          _id: campaign._id,
          endTime,
          endDate: campaign.endDate ?? null,
          title: (campaign.title as string | null | undefined) ?? null,
          description: campaign.description ?? null,
          placeName: campaign.placeName ?? null,
          difficulty: campaign.difficulty,
          location: campaign.location,
          district: campaign.district ?? null,
          hostId: campaign.hostId,
          participants: (campaign.participants ?? []) as Array<{
            userId: Types.ObjectId;
            status?: string;
          }>,
        });
      }
    }

    if (toClose.length > 0) {
      // mark campaigns as completed and open a 24h verification window for host
      const updates: any[] = toClose.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              completed: true,
              lifecyclePhase: 'completed',
              awaitingVerification: true,
              'timeline.completedAt': new Date(),
              'timeline.nextTransitionAt': null,
              verificationDeadline: new Date(
                item.endTime + CampaignService.DAY_MS,
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

  private isCampaignClosedForApproval(candidate: {
    completed?: boolean;
    failed?: boolean;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    durationDays?: number | null;
  }) {
    if (candidate.completed || candidate.failed) {
      return true;
    }

    if (!candidate.startDate) {
      return false;
    }

    const startTime = new Date(candidate.startDate).getTime();
    if (!Number.isFinite(startTime)) {
      return false;
    }

    const explicitEndTime = candidate.endDate
      ? new Date(candidate.endDate).getTime()
      : Number.NaN;
    const durationDays = Math.max(1, Number(candidate.durationDays ?? 1));
    const endTime = Number.isFinite(explicitEndTime)
      ? explicitEndTime
      : startTime + durationDays * 24 * 60 * 60 * 1000;

    return Date.now() >= endTime;
  }

  private async autoRejectClosedSubmittedCampaigns() {
    const pendingApprovalCampaigns = await this.campaignModel
      .find({
        deletedByAdmin: false,
        approvalStatus: { $in: ['submitted', 'draft'] },
      })
      .select(
        '_id title hostId startDate endDate durationDays completed failed',
      )
      .lean();

    if (pendingApprovalCampaigns.length === 0) {
      return;
    }

    const now = new Date();
    const toReject = pendingApprovalCampaigns.filter((campaign) =>
      this.isCampaignClosedForApproval(campaign),
    );

    if (toReject.length === 0) {
      return;
    }

    const ids = toReject.map((campaign) => campaign._id);
    await this.campaignModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          approvalStatus: 'rejected',
          rejectedAt: now,
          rejectedBy: null,
          approvedAt: null,
          approvedBy: null,
          approvalNote:
            'Auto-rejected because the campaign was already closed before approval.',
          awaitingVerification: false,
          verificationDeadline: null,
        },
      },
    );

    for (const campaign of toReject) {
      await this.audit.logEvent({
        type: 'campaign.auto_reject_closed',
        campaignId: campaign._id.toString(),
        hostId: campaign.hostId.toString(),
      });
    }
  }

  private async normalizeDraftApprovalStatuses() {
    const draftCampaigns = await this.campaignModel
      .find({
        deletedByAdmin: false,
        approvalStatus: 'draft',
      })
      .select('_id difficulty startDate endDate durationDays completed failed')
      .lean();

    if (draftCampaigns.length === 0) {
      return;
    }

    const toSubmitted: Types.ObjectId[] = [];
    const toApproved: Types.ObjectId[] = [];

    for (const campaign of draftCampaigns) {
      if (this.isCampaignClosedForApproval(campaign)) {
        continue;
      }

      const requiresApproval = await this.getDifficultyApprovalRequirement(
        campaign.difficulty,
      );
      if (requiresApproval) {
        toSubmitted.push(campaign._id);
      } else {
        toApproved.push(campaign._id);
      }
    }

    if (toSubmitted.length > 0) {
      await this.campaignModel.updateMany(
        { _id: { $in: toSubmitted } },
        {
          $set: {
            approvalStatus: 'submitted',
            submittedAt: new Date(),
            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
            approvalNote: null,
          },
        },
      );
    }

    if (toApproved.length > 0) {
      await this.campaignModel.updateMany(
        { _id: { $in: toApproved } },
        {
          $set: {
            approvalStatus: 'approved',
            submittedAt: null,
            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
            approvalNote: null,
          },
        },
      );
    }
  }

  private async processVerificationDeadlines() {
    const now = new Date();
    const expired = await this.campaignModel
      .find({
        awaitingVerification: true,
        verificationDeadline: { $ne: null, $lte: now },
        deletedByAdmin: false,
      })
      .lean();

    if (expired.length === 0) return;

    const ids = expired.map((c) => c._id);
    await this.campaignModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          completed: false,
          failed: true,
          awaitingVerification: false,
          failedAt: new Date(),
          lifecyclePhase: 'cancelled',
          cancellationReason: 'No completion evidence uploaded within 24 hours',
          'timeline.cancelledAt': new Date(),
          'timeline.nextTransitionAt': null,
        },
      },
    );

    for (const campaign of expired) {
      await this.audit.logEvent({
        type: 'campaign.verification_failed',
        campaignId: campaign._id.toString(),
        hostId: campaign.hostId.toString(),
      });
    }
  }

  // public wrapper for scheduled jobs
  async runVerificationHousekeeping() {
    await this.autoCloseExpiredCampaigns();
    await this.processVerificationDeadlines();
    await this.normalizeDraftApprovalStatuses();
    await this.autoRejectClosedSubmittedCampaigns();
    await this.processLifecycleTransitions();
    await this.processHostInactivity();
  }

  async verifyCampaignCompletion(
    id: string,
    requesterId: string,
    evidence: {
      url: string;
      mediaType: 'image' | 'video';
      publicId?: string | null;
      caption?: string | null;
    },
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    if (campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException(
        'Only the host can verify campaign completion',
      );
    }

    if (!campaign.completed || !campaign.awaitingVerification) {
      throw new BadRequestException('Campaign is not awaiting verification');
    }

    const now = new Date();
    if (
      !campaign.verificationDeadline ||
      now.getTime() > new Date(campaign.verificationDeadline).getTime()
    ) {
      throw new BadRequestException('Verification window has expired');
    }

    const evidenceUrl = evidence?.url?.trim();
    if (!evidenceUrl) {
      throw new BadRequestException(
        'An image or video is required to verify trip completion',
      );
    }

    const publicId = evidence.publicId?.trim();
    let parsedEvidenceUrl: URL;
    try {
      parsedEvidenceUrl = new URL(evidenceUrl);
    } catch {
      throw new BadRequestException('Invalid completion evidence URL');
    }
    if (
      parsedEvidenceUrl.protocol !== 'https:' ||
      parsedEvidenceUrl.hostname !== 'res.cloudinary.com' ||
      !parsedEvidenceUrl.pathname.includes(`/${evidence.mediaType}/upload/`) ||
      !publicId?.startsWith('campaign_verification/')
    ) {
      throw new BadRequestException(
        'Completion evidence must be an uploaded TripSathi image or video',
      );
    }

    campaign.verificationPhotos = campaign.verificationPhotos || [];
    campaign.verificationPhotos.push({
      url: evidenceUrl,
      publicId,
      caption: evidence.caption?.trim() || null,
      mediaType: evidence.mediaType,
    } as any);

    campaign.hostVerified = true;
    campaign.verifiedAt = new Date();
    campaign.awaitingVerification = false;

    await campaign.save();

    // award xp now (host + participants)
    const campaignId = campaign._id.toString();
    const normalizedDifficulty = (campaign.difficulty as string | undefined)
      ?.trim()
      .toLowerCase();
    const normalizedDistrict =
      (campaign.district as string | undefined)?.trim().toLowerCase() ??
      (campaign.location as string | undefined)?.trim().toLowerCase();
    const locationKey = (
      (campaign.placeName as string | undefined) ??
      (campaign.location as string | undefined) ??
      (campaign.district as string | undefined) ??
      ''
    )
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
          subcategory: this.getCampaignCompletionSubcategory(
            campaign.difficulty,
          ),
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

    await this.recordVerifiedCampaignVisits(
      [
        campaign.hostId.toString(),
        ...acceptedParticipants.map((participant) =>
          (participant as any).userId.toString(),
        ),
      ],
      campaign,
    );

    await this.audit.logEvent({
      type: 'campaign.verified_completion',
      campaignId,
      hostId: requesterId,
    });

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
          name: this.buildCreatorName(
            profile as Partial<User>,
            phoneNumber ?? 'Unknown',
          ),
          role: host?.role ?? 'user',
          phoneNumber,
        },
      };
    });
  }

  private canUserEditCampaign(status?: CampaignApprovalStatus | null) {
    return status === 'draft' || status === 'rejected';
  }

  private async getDifficultyApprovalRequirement(
    difficulty?: string | null,
  ): Promise<boolean> {
    if (!difficulty || !difficulty.trim()) {
      return false;
    }

    const difficultyItems = await this.extraService.getDifficulties();

    const matched = difficultyItems.find(
      (item) =>
        item.enabled !== false &&
        (item.id.toLowerCase() === difficulty.trim().toLowerCase() ||
          item.label.toLowerCase() === difficulty.trim().toLowerCase()),
    );

    return matched?.adminApprovalRequired ?? false;
  }

  async createCampaign(
    dto: CreateCampaignDto,
    hostId: string,
    isAdmin = false,
  ) {
    const campaignCode = await this.createUniqueCampaignCode();
    const scheduleType = dto.scheduleType ?? 'scheduled';
    const activity = await this.resolveCampaignActivity(
      dto.category,
      dto.subcategory,
    );
    const hikeType = this.normalizeCampaignType(dto.hikeType);

    if (!hikeType) {
      throw new BadRequestException('hikeType is required');
    }

    if (hikeType === 'group' && scheduleType === 'instant') {
      throw new BadRequestException('Group campaigns must be scheduled');
    }

    let startDate = this.parseDateValue(dto.startDate);
    let joinOpenDate =
      dto.joinOpenDate !== undefined
        ? this.parseDateValue(dto.joinOpenDate)
        : null;
    const endDate = this.parseDateValue(dto.endDate);

    if (scheduleType === 'instant') {
      const now = new Date();
      startDate = now;
      joinOpenDate = now;
    } else {
      if (!startDate) {
        throw new BadRequestException(
          'startDate is required for scheduled campaigns',
        );
      }

      joinOpenDate ??= hikeType === 'group' ? new Date() : startDate;
    }

    if (hikeType === 'group') {
      joinOpenDate = new Date();
    }

    const resolvedEndDate =
      scheduleType === 'instant'
        ? this.getInstantCampaignEndDate(startDate)
        : endDate;

    if (
      hikeType === 'group' &&
      startDate &&
      startDate.getTime() < this.getMinimumUserStartDate('group').getTime()
    ) {
      throw new BadRequestException(
        'Group campaigns must be scheduled at least 9 days in advance',
      );
    }

    if (
      !isAdmin &&
      scheduleType === 'scheduled' &&
      hikeType !== 'group' &&
      startDate &&
      startDate.getTime() < this.getMinimumUserStartDate(hikeType).getTime()
    ) {
      throw new BadRequestException(
        'User campaigns must be scheduled at least 2 days in advance',
      );
    }

    this.validateTiming(startDate, resolvedEndDate, joinOpenDate);

    const maxParticipants = Math.max(1, Number(dto.maxParticipants ?? 1));
    const minParticipants =
      hikeType === 'group' ? Math.max(1, Number(dto.minParticipants ?? 2)) : 1;
    if (minParticipants > maxParticipants) {
      throw new BadRequestException(
        'minParticipants cannot be greater than maxParticipants',
      );
    }

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      category: _category,
      subcategory: _subcategory,
      hikeType: _hikeType,
      province,
      district,
      municipality,
      placeName,
      location,
      ...rest
    } = dto;

    const normalizedProvince = this.normalizeLocationPart(province);
    const normalizedDistrict = this.normalizeLocationPart(district);
    const normalizedMunicipality = this.normalizeLocationPart(municipality);
    const normalizedPlaceName = this.normalizeLocationPart(placeName);
    const normalizedLocation =
      this.normalizeLocationPart(location) ??
      this.buildDisplayLocation(
        normalizedProvince,
        normalizedDistrict,
        normalizedMunicipality,
        normalizedPlaceName,
      );

    const requiresAdminApproval = await this.getDifficultyApprovalRequirement(
      dto.difficulty,
    );
    if (scheduleType === 'instant' && requiresAdminApproval) {
      throw new BadRequestException(
        'Instant solo trips are available only for difficulties that do not require admin approval',
      );
    }
    const approvalStatus: CampaignApprovalStatus = requiresAdminApproval
      ? 'submitted'
      : 'approved';
    const now = new Date();
    const planningState = dto.planning
      ? {
          transportDecision: dto.planning.transportDecision?.trim() || null,
          meetingPoint: dto.planning.meetingPoint?.trim() || null,
          meetingTime: dto.planning.meetingTime
            ? new Date(dto.planning.meetingTime)
            : null,
          costBreakdown: {
            transport: Number(dto.planning.costBreakdown?.transport ?? 0),
            food: Number(dto.planning.costBreakdown?.food ?? 0),
            guide: Number(dto.planning.costBreakdown?.guide ?? 0),
            misc: Number(dto.planning.costBreakdown?.misc ?? 0),
            totalCost: 0,
            costPerPerson: 0,
          },
          tasks: (dto.planning.tasks ?? []).map((task) => ({
            title: task.title.trim(),
            assignedUserId: task.assignedUserId
              ? new Types.ObjectId(task.assignedUserId)
              : null,
            completed: task.completed === true,
            completedAt: task.completed === true ? new Date() : null,
          })),
          isComplete: false,
          completenessErrors: [],
          lastUpdatedAt: now,
        }
      : this.getDefaultPlanningState();

    const baseTimeline = {
      createdAt: now,
      openAt: null,
      planningAt: null,
      verificationAt: null,
      readyAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      nextTransitionAt: null,
    } as any;

    let lifecyclePhase: CampaignLifecyclePhase = dto.lifecyclePhase ?? 'draft';
    if (hikeType === 'group') {
      const lifecycleTimeline = this.calculateGroupTimeline(startDate, now);
      baseTimeline.openAt = lifecycleTimeline.openAt;
      baseTimeline.planningAt = lifecycleTimeline.planningAt;
      baseTimeline.verificationAt = lifecycleTimeline.verificationAt;
      baseTimeline.readyAt = lifecycleTimeline.readyAt;
      baseTimeline.nextTransitionAt =
        approvalStatus === 'approved'
          ? lifecycleTimeline.nextTransitionAt
          : null;
      lifecyclePhase = approvalStatus === 'approved' ? 'open' : 'draft';
    } else {
      const readyAt = new Date(startDate.getTime() - CampaignService.DAY_MS);
      baseTimeline.readyAt = readyAt;
      baseTimeline.nextTransitionAt =
        approvalStatus === 'approved' ? startDate : null;
      lifecyclePhase = approvalStatus === 'approved' ? 'ready' : 'draft';
    }

    const draftCampaignPayload = {
      ...planningState,
      tasks: planningState.tasks ?? [],
    } as any;

    // Enforce per-user annual campaign creation quota (unless admin)
    if (!isAdmin) {
      const user = await this.userModel.findById(hostId);
      if (user) {
        const nowYear = new Date().getUTCFullYear();
        const lastResetYear = user.campaignQuotaResetAt
          ? new Date(user.campaignQuotaResetAt).getUTCFullYear()
          : null;
        if (lastResetYear === null || lastResetYear < nowYear) {
          user.campaignQuota = 5;
          // set to Jan 1 of current year
          user.campaignQuotaResetAt = new Date(Date.UTC(nowYear, 0, 1));
        }

        if (!user.campaignQuota || user.campaignQuota <= 0) {
          throw new BadRequestException(
            'Campaign creation quota exceeded for this year',
          );
        }

        user.campaignQuota = Math.max(0, Number(user.campaignQuota) - 1);
        await user.save();
      }
    }

    const created = await this.campaignModel.create({
      campaignCode,
      ...rest,
      genderVisibility:
        hikeType === 'group' ? (dto.genderVisibility ?? 'all') : 'all',
      visibility:
        hikeType === 'group' ? (dto.visibility ?? 'public') : 'public',
      category: activity.category,
      subcategory: activity.subcategory,
      hikeType,
      location: normalizedLocation,
      province: normalizedProvince,
      district: normalizedDistrict,
      municipality: normalizedMunicipality,
      placeName: normalizedPlaceName,
      scheduleType,
      startDate,
      endDate: resolvedEndDate,
      joinOpenDate,
      minParticipants,
      maxParticipants,
      hostId: new Types.ObjectId(hostId),
      participantsLocked: false,
      lifecyclePhase,
      phaseLocked: false,
      phaseVersion: 0,
      timeline: baseTimeline,
      planning: draftCampaignPayload,
      adminVerification: {
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      },
      hostInactivityReminderCount: 0,
      cancellationReason: null,
      approvalStatus,
      submittedAt: requiresAdminApproval ? now : null,
      approvedAt: !requiresAdminApproval ? now : null,
      approvedBy:
        !requiresAdminApproval && isAdmin ? new Types.ObjectId(hostId) : null,
      rejectedAt: null,
      rejectedBy: null,
      approvalNote: null,
    });
    this.recomputePlanningCost(created);
    this.evaluatePlanningCompleteness(created);
    await created.save();

    if (created.lifecyclePhase === 'open') {
      await this.notifyParticipants(
        created,
        'Campaign open',
        `Campaign "${created.title}" is now open for coordination.`,
        { campaignId: created._id.toString(), phase: created.lifecyclePhase },
      );
    }
    await this.audit.logEvent({
      type: 'campaign.create',
      campaignId: created._id.toString(),
      hostId,
    });
    return this.getCampaignById(created._id.toString());
  }

  async listCampaigns(
    page = 1,
    limit = 20,
    includeFuture = false,
    approvalStatus?: CampaignApprovalStatus,
    groupOnly = false,
    viewerId?: string,
  ) {
    await this.runVerificationHousekeeping();

    const skip = (page - 1) * limit;
    const now = new Date();
    const filter: Record<string, unknown> = {
      deletedByAdmin: false,
      ...(groupOnly ? { hikeType: 'group' } : {}),
    };

    if (viewerId && Types.ObjectId.isValid(viewerId)) {
      const viewer = await this.userModel
        .findOne({ authId: new Types.ObjectId(viewerId) })
        .select('gender')
        .lean();
      const viewerGender = viewer?.gender;
      filter.$or = [
        { hostId: new Types.ObjectId(viewerId) },
        { genderVisibility: { $exists: false } },
        { genderVisibility: 'all' },
        ...(viewerGender === 'male' || viewerGender === 'female'
          ? [{ genderVisibility: viewerGender }]
          : []),
      ];
    }

    if (approvalStatus) {
      filter.approvalStatus = approvalStatus;
    }

    const accessRules: Record<string, unknown>[] = [];
    if (viewerId) {
      accessRules.push({
        $or: [{ visibility: { $exists: false } }, { visibility: 'public' }],
      });
    }

    if (!includeFuture) {
      accessRules.push(
        {
          approvalStatus: 'approved',
        },
        {
          lifecyclePhase: { $nin: ['completed', 'cancelled'] },
        },
        {
          completed: { $ne: true },
        },
        {
          failed: { $ne: true },
        },
        {
          $or: [{ endDate: null }, { endDate: { $gt: now } }],
        },
        {
          $or: [{ joinOpenDate: null }, { joinOpenDate: { $lte: now } }],
        },
      );
    }
    if (accessRules.length > 0) filter.$and = accessRules;

    const rawItems = await this.campaignModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .lean();
    const items = await this.enrichWithCreator(
      rawItems as Array<Record<string, any>>,
    );
    const total = await this.campaignModel.countDocuments(filter);
    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listUserCampaigns(hostId: string, page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const filter = {
      hostId: new Types.ObjectId(hostId),
      deletedByAdmin: false,
    };
    const [rawItems, total] = await Promise.all([
      this.campaignModel
        .find(filter)
        .sort({ startDate: -1, createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      this.campaignModel.countDocuments(filter),
    ]);
    const items = await this.enrichWithCreator(
      rawItems as Array<Record<string, any>>,
    );
    return {
      items,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async listDeletedCampaigns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const rawItems = await this.campaignModel
      .find({ deletedByAdmin: true })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = await this.enrichWithCreator(
      rawItems as Array<Record<string, any>>,
    );
    const total = await this.campaignModel.countDocuments({
      deletedByAdmin: true,
    });

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getCampaignById(id: string, viewerId?: string, isAdmin = false) {
    await this.runVerificationHousekeeping();

    const item = await this.campaignModel.findById(id).lean();
    if (!item || item.deletedByAdmin)
      throw new NotFoundException('Campaign not found');

    if (
      item.hikeType === 'solo' &&
      viewerId &&
      !isAdmin &&
      item.hostId.toString() !== viewerId
    ) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      viewerId &&
      !isAdmin &&
      item.hostId.toString() !== viewerId &&
      item.visibility === 'private'
    ) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      viewerId &&
      !isAdmin &&
      item.hostId.toString() !== viewerId &&
      item.genderVisibility &&
      item.genderVisibility !== 'all'
    ) {
      const viewer = await this.userModel
        .findOne({ authId: new Types.ObjectId(viewerId) })
        .select('gender')
        .lean();
      if (viewer?.gender !== item.genderVisibility) {
        throw new NotFoundException('Campaign not found');
      }
    }

    const [enriched] = await this.enrichWithCreator([
      item as Record<string, any>,
    ]);
    return enriched;
  }

  async getPrivateCampaignByCode(code: string, viewerId: string) {
    await this.runVerificationHousekeeping();
    const normalizedCode = this.normalizeCampaignCode(code);
    const item = await this.campaignModel
      .findOne({
        campaignCode: normalizedCode,
        visibility: 'private',
        deletedByAdmin: false,
      })
      .lean();
    if (!item) throw new NotFoundException('Private campaign not found');

    if (
      item.hostId.toString() !== viewerId &&
      item.genderVisibility &&
      item.genderVisibility !== 'all'
    ) {
      const viewer = await this.userModel
        .findOne({ authId: new Types.ObjectId(viewerId) })
        .select('gender')
        .lean();
      if (viewer?.gender !== item.genderVisibility) {
        throw new NotFoundException('Private campaign not found');
      }
    }

    const [enriched] = await this.enrichWithCreator([
      item as Record<string, any>,
    ]);
    return enriched;
  }

  async joinCampaign(id: string, userId: string, accessCode?: string) {
    await this.runVerificationHousekeeping();

    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.hikeType === 'solo' && campaign.hostId.toString() !== userId) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      campaign.visibility === 'private' &&
      this.normalizeCampaignCode(accessCode ?? '') !== campaign.campaignCode
    ) {
      throw new ForbiddenException('A valid private campaign code is required');
    }

    if (campaign.approvalStatus !== 'approved') {
      throw new BadRequestException('Only approved campaigns can be joined');
    }

    if (campaign.genderVisibility && campaign.genderVisibility !== 'all') {
      const traveler = await this.userModel
        .findOne({ authId: new Types.ObjectId(userId) })
        .select('gender')
        .lean();
      if (traveler?.gender !== campaign.genderVisibility) {
        throw new ForbiddenException(
          'This trip is limited to travelers of the selected gender',
        );
      }
    }

    if (
      campaign.completed ||
      campaign.failed ||
      campaign.awaitingVerification
    ) {
      throw new BadRequestException('Campaign is closed');
    }

    if (campaign.lifecyclePhase !== 'open') {
      throw new BadRequestException('Users can join only during open phase');
    }

    if (campaign.minimumParticipantDecisionRequired) {
      throw new BadRequestException(
        'Campaign enrollment has ended and is awaiting the host decision',
      );
    }

    if (campaign.participantsLocked) {
      throw new BadRequestException(
        'Participants are locked for this campaign',
      );
    }

    const now = new Date();
    if (
      campaign.joinOpenDate &&
      campaign.joinOpenDate.getTime() > now.getTime()
    ) {
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
      throw new BadRequestException(
        'You are already enrolled in this campaign',
      );
    }

    if (existingParticipant?.status === 'pending') {
      throw new BadRequestException(
        'Your request is already pending for this campaign',
      );
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
      existingParticipant.role = existingParticipant.role ?? 'member';
      existingParticipant.joinedAt = existingParticipant.joinedAt ?? new Date();
      existingParticipant.leftAt = null;
      existingParticipant.confirmed = false;
      existingParticipant.confirmedAt = null;
      existingParticipant.dropoutFlag = false;
      existingParticipant.verified = false;
      existingParticipant.completionDays = null;
    } else {
      participants.push({
        userId: new Types.ObjectId(userId),
        status: nextStatus,
        role: 'member',
        joinedAt: new Date(),
        leftAt: null,
        confirmed: false,
        confirmedAt: null,
        dropoutFlag: false,
        verified: false,
        completionDays: null,
      });
    }

    campaign.participants = participants;
    this.recomputePlanningCost(campaign);
    this.evaluatePlanningCompleteness(campaign);
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.join',
      campaignId: id,
      userId,
      status: nextStatus,
      joinMode: campaign.joinMode,
    });

    return {
      message:
        nextStatus === 'accepted'
          ? 'Successfully enrolled in campaign'
          : 'Campaign join request submitted',
      campaign: await this.getCampaignById(id),
    };
  }

  private ensureCampaignManagePermission(
    campaign: any,
    requesterId: string,
    isAdmin = false,
  ) {
    if (!isAdmin && campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Not allowed to manage this campaign');
    }
  }

  async leaveCampaign(id: string, userId: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    const participant = (campaign.participants ?? []).find(
      (item: any) =>
        item.userId.toString() === userId && item.status === 'accepted',
    );
    if (!participant) {
      throw new BadRequestException(
        'You are not an active participant in this campaign',
      );
    }

    if (
      campaign.lifecyclePhase !== 'open' &&
      campaign.lifecyclePhase !== 'planning'
    ) {
      throw new BadRequestException(
        'Leaving is allowed only during open/planning phases',
      );
    }

    participant.status = 'left';
    participant.leftAt = new Date();
    participant.dropoutFlag = campaign.lifecyclePhase === 'planning';
    participant.confirmed = false;
    participant.confirmedAt = null;

    this.recomputePlanningCost(campaign);
    this.evaluatePlanningCompleteness(campaign);
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.leave',
      campaignId: id,
      userId,
      phase: campaign.lifecyclePhase,
    });

    return this.getCampaignById(id);
  }

  async confirmParticipation(id: string, userId: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    const participant = (campaign.participants ?? []).find(
      (item: any) =>
        item.userId.toString() === userId && item.status === 'accepted',
    );
    if (!participant) {
      throw new BadRequestException('Only active participants can confirm');
    }

    participant.confirmed = true;
    participant.confirmedAt = new Date();
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.confirm_participation',
      campaignId: id,
      userId,
    });

    return this.getCampaignById(id);
  }

  async updateParticipantRole(
    id: string,
    participantId: string,
    role: 'host' | 'co-host' | 'member',
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    this.ensureCampaignManagePermission(campaign, requesterId, isAdmin);

    const participant = (campaign.participants ?? []).find(
      (item: any) => item.userId.toString() === participantId,
    );
    if (!participant) {
      throw new NotFoundException('Participant not found in campaign');
    }

    participant.role = role;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.participant_role_update',
      campaignId: id,
      requesterId,
      participantId,
      role,
    });

    return this.getCampaignById(id);
  }

  async updatePlanning(
    id: string,
    dto: UpdatePlanningDto,
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    this.ensureCampaignManagePermission(campaign, requesterId, isAdmin);

    if (campaign.lifecyclePhase !== 'planning' && !isAdmin) {
      throw new BadRequestException(
        'Planning can be edited only during planning phase',
      );
    }

    campaign.planning = campaign.planning ?? this.getDefaultPlanningState();
    if (dto.transportDecision !== undefined) {
      campaign.planning.transportDecision = dto.transportDecision.trim();
    }
    if (dto.meetingPoint !== undefined) {
      campaign.planning.meetingPoint = dto.meetingPoint.trim();
    }
    if (dto.meetingTime !== undefined) {
      const parsed = new Date(dto.meetingTime);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid meetingTime');
      }
      campaign.planning.meetingTime = parsed;
    }

    if (dto.costBreakdown) {
      campaign.planning.costBreakdown = campaign.planning.costBreakdown ?? {
        transport: 0,
        food: 0,
        guide: 0,
        misc: 0,
        totalCost: 0,
        costPerPerson: 0,
      };
      if (dto.costBreakdown.transport !== undefined) {
        campaign.planning.costBreakdown.transport = dto.costBreakdown.transport;
      }
      if (dto.costBreakdown.food !== undefined) {
        campaign.planning.costBreakdown.food = dto.costBreakdown.food;
      }
      if (dto.costBreakdown.guide !== undefined) {
        campaign.planning.costBreakdown.guide = dto.costBreakdown.guide;
      }
      if (dto.costBreakdown.misc !== undefined) {
        campaign.planning.costBreakdown.misc = dto.costBreakdown.misc;
      }
    }

    campaign.lastPlanningActivityAt = new Date();
    this.recomputePlanningCost(campaign);
    this.evaluatePlanningCompleteness(campaign);
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.planning_update',
      campaignId: id,
      requesterId,
    });

    return this.getCampaignById(id);
  }

  async addTask(
    id: string,
    dto: AddTaskDto,
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    this.ensureCampaignManagePermission(campaign, requesterId, isAdmin);

    campaign.planning = campaign.planning ?? this.getDefaultPlanningState();
    campaign.planning.tasks = campaign.planning.tasks ?? [];
    campaign.planning.tasks.push({
      title: dto.title.trim(),
      assignedUserId: dto.assignedUserId
        ? new Types.ObjectId(dto.assignedUserId)
        : null,
      completed: false,
      completedAt: null,
    } as any);

    campaign.lastPlanningActivityAt = new Date();
    this.evaluatePlanningCompleteness(campaign);
    await campaign.save();

    return this.getCampaignById(id);
  }

  async updateTask(
    id: string,
    taskId: string,
    dto: UpdateTaskDto,
    requesterId: string,
    isAdmin = false,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    this.ensureCampaignManagePermission(campaign, requesterId, isAdmin);

    const tasks = campaign.planning?.tasks ?? [];
    const task = tasks.find((item: any) => item._id?.toString() === taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (dto.title !== undefined) {
      task.title = dto.title.trim();
    }
    if (dto.assignedUserId !== undefined) {
      task.assignedUserId = dto.assignedUserId
        ? new Types.ObjectId(dto.assignedUserId)
        : null;
    }
    if (dto.completed !== undefined) {
      task.completed = dto.completed;
      task.completedAt = dto.completed ? new Date() : null;
    }

    campaign.lastPlanningActivityAt = new Date();
    this.evaluatePlanningCompleteness(campaign);
    await campaign.save();
    return this.getCampaignById(id);
  }

  async listCampaignsByLifecyclePhase(
    phase: CampaignLifecyclePhase,
    page = 1,
    limit = 20,
  ) {
    const skip = Math.max(0, (page - 1) * limit);
    const filter = { deletedByAdmin: false, lifecyclePhase: phase };
    const rawItems = await this.campaignModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const items = await this.enrichWithCreator(
      rawItems as Array<Record<string, any>>,
    );
    const total = await this.campaignModel.countDocuments(filter);
    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private async processSinglePhaseTransition(campaign: any) {
    if (campaign.phaseLocked || campaign.approvalStatus !== 'approved') {
      return;
    }

    const now = new Date();
    const phase = campaign.lifecyclePhase as CampaignLifecyclePhase;
    if (!phase || phase === 'completed' || phase === 'cancelled') {
      return;
    }

    if (
      campaign.timeline?.nextTransitionAt &&
      new Date(campaign.timeline.nextTransitionAt).getTime() > now.getTime()
    ) {
      return;
    }

    let nextPhase: CampaignLifecyclePhase | null = null;
    if (phase === 'open') {
      if (
        this.countAcceptedParticipants(campaign) <
        Math.max(1, Number(campaign.minParticipants ?? 1))
      ) {
        if (campaign.minimumParticipantDecisionRequired) {
          return;
        }
        campaign.minimumParticipantDecisionRequired = true;
        campaign.minimumParticipantDecisionRequestedAt = now;
        campaign.minimumParticipantDecision = null;
        campaign.minimumParticipantDecisionAt = null;
        campaign.participantsLocked = true;
        campaign.timeline = campaign.timeline ?? {};
        campaign.timeline.nextTransitionAt = null;
        await campaign.save();
        await this.notificationService.createBulkNotifications(
          [campaign.hostId.toString()],
          'admin_message',
          'Campaign decision required',
          `Campaign "${campaign.title}" did not reach its minimum participant requirement. Choose whether to continue to planning or end the campaign.`,
          {
            campaignId: campaign._id.toString(),
            action: 'minimum_participants_decision',
            acceptedParticipants: this.countAcceptedParticipants(campaign),
            minimumParticipants: Math.max(
              1,
              Number(campaign.minParticipants ?? 1),
            ),
          },
        );
        return;
      } else {
        nextPhase = 'planning';
      }
    } else if (phase === 'planning') {
      this.evaluatePlanningCompleteness(campaign);
      if (!campaign.planning?.isComplete) {
        await this.notifyParticipants(
          campaign,
          'Planning incomplete',
          `Campaign "${campaign.title}" planning is incomplete. Please fill required planning details.`,
          {
            campaignId: campaign._id.toString(),
            phase: 'planning',
            missing: campaign.planning?.completenessErrors ?? [],
          },
        );
        campaign.timeline.nextTransitionAt = new Date(
          now.getTime() + 6 * 60 * 60 * 1000,
        );
        await campaign.save();
        return;
      }
      nextPhase = 'verification';
      campaign.participantsLocked = true;
      campaign.adminVerification = {
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      };
    } else if (phase === 'verification') {
      if (campaign.adminVerification?.status !== 'approved') {
        await this.notifyParticipants(
          campaign,
          'Verification pending',
          `Campaign "${campaign.title}" is waiting for admin verification.`,
          { campaignId: campaign._id.toString(), phase: 'verification' },
        );
        campaign.timeline.nextTransitionAt = new Date(
          now.getTime() + 6 * 60 * 60 * 1000,
        );
        await campaign.save();
        return;
      }
      nextPhase = 'ready';
    } else if (phase === 'ready') {
      const accepted = this.countAcceptedParticipants(campaign);
      const confirmed = this.countConfirmedParticipants(campaign);
      if (accepted > confirmed) {
        await this.notifyParticipants(
          campaign,
          'Confirmation required',
          `Campaign "${campaign.title}" has unconfirmed participants.`,
          {
            campaignId: campaign._id.toString(),
            phase: 'ready',
            accepted,
            confirmed,
          },
        );
        campaign.timeline.nextTransitionAt = new Date(
          now.getTime() + 2 * 60 * 60 * 1000,
        );
        await campaign.save();
        return;
      }
      nextPhase = 'started';
    } else if (phase === 'started') {
      const endTime = this.getCampaignEndTime(campaign);
      if (!Number.isFinite(endTime) || now.getTime() < endTime) {
        campaign.timeline.nextTransitionAt = Number.isFinite(endTime)
          ? new Date(endTime)
          : null;
        await campaign.save();
        return;
      }
      nextPhase = 'completed';
    } else if (phase === 'draft') {
      if (campaign.hikeType === 'group') {
        nextPhase = 'open';
      } else {
        nextPhase = 'ready';
      }
    }

    if (!nextPhase) {
      return;
    }

    await this.transitionCampaignPhase(
      campaign._id.toString(),
      nextPhase,
      campaign.hostId.toString(),
      true,
      'Automated transition',
    );
  }

  private async processLifecycleTransitions() {
    const now = new Date();
    const candidates = await this.campaignModel
      .find({
        deletedByAdmin: false,
        lifecyclePhase: { $nin: ['completed', 'cancelled'] },
        approvalStatus: 'approved',
        'timeline.nextTransitionAt': { $ne: null, $lte: now },
      })
      .limit(200);

    for (const campaign of candidates) {
      await this.processSinglePhaseTransition(campaign);
    }
  }

  private async processHostInactivity() {
    const threshold = new Date(
      Date.now() - CampaignService.HOST_INACTIVITY_LIMIT_MS,
    );
    const candidates = await this.campaignModel.find({
      deletedByAdmin: false,
      lifecyclePhase: 'planning',
      $or: [
        { lastPlanningActivityAt: null },
        { lastPlanningActivityAt: { $lte: threshold } },
      ],
    });

    for (const campaign of candidates) {
      const reminders = Number(campaign.hostInactivityReminderCount ?? 0);
      if (reminders < CampaignService.MAX_HOST_INACTIVITY_REMINDERS) {
        campaign.hostInactivityReminderCount = reminders + 1;
        campaign.lastPlanningActivityAt = new Date();
        await campaign.save();
        await this.notifyParticipants(
          campaign,
          'Host inactivity reminder',
          `Planning activity is required for campaign "${campaign.title}".`,
          {
            campaignId: campaign._id.toString(),
            reminders: campaign.hostInactivityReminderCount,
          },
        );
      } else {
        await this.transitionCampaignPhase(
          campaign._id.toString(),
          'cancelled',
          campaign.hostId.toString(),
          true,
          'Auto-cancelled due to host inactivity',
        );
      }
    }
  }

  async transitionCampaignPhase(
    id: string,
    toPhase: CampaignLifecyclePhase,
    requesterId: string,
    isAdmin = false,
    reason?: string,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    this.ensureCampaignManagePermission(campaign, requesterId, isAdmin);

    const fromPhase = campaign.lifecyclePhase;
    if (fromPhase === toPhase) {
      return this.getCampaignById(id);
    }

    this.ensureValidPhaseTransition(fromPhase, toPhase);

    if (toPhase === 'verification') {
      this.evaluatePlanningCompleteness(campaign);
      if (!campaign.planning?.isComplete) {
        throw new BadRequestException(
          `Cannot move to verification. Missing fields: ${(campaign.planning?.completenessErrors ?? []).join(', ')}`,
        );
      }
    }

    if (toPhase === 'started') {
      const accepted = this.countAcceptedParticipants(campaign);
      const confirmed = this.countConfirmedParticipants(campaign);
      if (accepted > confirmed) {
        throw new BadRequestException(
          'All active participants must confirm before campaign starts',
        );
      }
    }

    campaign.lifecyclePhase = toPhase;
    campaign.phaseVersion = Number(campaign.phaseVersion ?? 0) + 1;
    campaign.timeline = campaign.timeline ?? {};
    const now = new Date();

    if (fromPhase === 'open') {
      campaign.minimumParticipantDecisionRequired = false;
    }

    if (toPhase === 'planning') {
      campaign.participantsLocked = true;
      campaign.timeline.nextTransitionAt =
        campaign.timeline.verificationAt ?? null;
    } else if (toPhase === 'verification') {
      campaign.timeline.nextTransitionAt = campaign.timeline.readyAt ?? null;
      campaign.adminVerification = campaign.adminVerification ?? {
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      };
    } else if (toPhase === 'ready') {
      campaign.timeline.nextTransitionAt = campaign.startDate ?? null;
    } else if (toPhase === 'started') {
      campaign.timeline.startedAt = now;
      const endTime = this.getCampaignEndTime(campaign);
      campaign.timeline.nextTransitionAt = Number.isFinite(endTime)
        ? new Date(endTime)
        : null;
    } else if (toPhase === 'completed') {
      campaign.timeline.completedAt = now;
      campaign.timeline.nextTransitionAt = null;
    } else if (toPhase === 'cancelled') {
      campaign.timeline.cancelledAt = now;
      campaign.timeline.nextTransitionAt = null;
      campaign.cancellationReason =
        reason?.trim() || campaign.cancellationReason || 'Cancelled';
    } else if (toPhase === 'open') {
      campaign.participantsLocked = false;
      campaign.timeline.nextTransitionAt = campaign.timeline.planningAt ?? null;
    } else if (toPhase === 'draft') {
      campaign.timeline.nextTransitionAt = null;
    }

    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.phase_transition',
      campaignId: id,
      requesterId,
      fromPhase,
      toPhase,
      reason: reason?.trim() || null,
      automated: isAdmin && reason === 'Automated transition',
    });

    await this.notifyParticipants(
      campaign,
      'Campaign phase updated',
      `Campaign "${campaign.title}" moved from ${fromPhase} to ${toPhase}.`,
      { campaignId: id, fromPhase, toPhase },
    );

    return this.getCampaignById(id);
  }

  async decideMinimumParticipants(
    id: string,
    decision: 'continue' | 'end',
    requesterId: string,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException(
        'Only the campaign host can make this decision',
      );
    }
    if (
      campaign.lifecyclePhase !== 'open' ||
      !campaign.minimumParticipantDecisionRequired
    ) {
      throw new BadRequestException(
        'This campaign is not awaiting a minimum participant decision',
      );
    }

    campaign.minimumParticipantDecisionRequired = false;
    campaign.minimumParticipantDecision = decision;
    campaign.minimumParticipantDecisionAt = new Date();
    await campaign.save();

    return this.transitionCampaignPhase(
      id,
      decision === 'continue' ? 'planning' : 'cancelled',
      requesterId,
      false,
      decision === 'continue'
        ? 'Host chose to continue below the minimum participant requirement'
        : 'Host ended the campaign after the minimum participant requirement was not met',
    );
  }

  async approvePlanningVerification(
    id: string,
    adminId: string,
    note?: string,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.lifecyclePhase !== 'verification') {
      throw new BadRequestException('Campaign is not in verification phase');
    }

    campaign.adminVerification = {
      status: 'approved',
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
      rejectionReason: note?.trim() || null,
    };
    campaign.timeline = campaign.timeline ?? {};
    campaign.timeline.nextTransitionAt =
      campaign.timeline.readyAt ?? new Date();
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.verification_approved',
      campaignId: id,
      adminId,
      note: note?.trim() || null,
    });

    await this.notifyParticipants(
      campaign,
      'Verification approved',
      `Campaign "${campaign.title}" has passed admin verification.`,
      { campaignId: id, verification: 'approved' },
    );

    return this.getCampaignById(id);
  }

  async rejectPlanningVerification(
    id: string,
    adminId: string,
    reason: string,
  ) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.lifecyclePhase !== 'verification') {
      throw new BadRequestException('Campaign is not in verification phase');
    }

    const normalizedReason = reason?.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    campaign.adminVerification = {
      status: 'rejected',
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
      rejectionReason: normalizedReason,
    };
    campaign.lifecyclePhase = 'planning';
    campaign.participantsLocked = true;
    campaign.timeline = campaign.timeline ?? {};
    campaign.timeline.nextTransitionAt = new Date(
      Date.now() + 6 * 60 * 60 * 1000,
    );
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.verification_rejected',
      campaignId: id,
      adminId,
      reason: normalizedReason,
    });

    await this.notifyParticipants(
      campaign,
      'Verification rejected',
      `Campaign "${campaign.title}" was sent back to planning: ${normalizedReason}`,
      { campaignId: id, verification: 'rejected', reason: normalizedReason },
    );

    return this.getCampaignById(id);
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

    if (
      !isAdmin &&
      ['completed', 'cancelled'].includes(campaign.lifecyclePhase)
    ) {
      throw new ForbiddenException('Finished campaigns cannot be edited');
    }

    const nextScheduleType =
      dto.scheduleType ?? campaign.scheduleType ?? 'scheduled';
    const nextActivity =
      dto.category !== undefined || dto.subcategory !== undefined
        ? await this.resolveCampaignActivity(
            dto.category ?? campaign.category,
            dto.subcategory !== undefined
              ? dto.subcategory
              : dto.category !== undefined
                ? null
                : campaign.subcategory,
          )
        : {
            category: campaign.category,
            subcategory: campaign.subcategory ?? null,
          };
    const nextHikeType =
      dto.hikeType !== undefined
        ? (() => {
            const normalizedHikeType = this.normalizeCampaignType(dto.hikeType);

            if (!normalizedHikeType) {
              throw new BadRequestException('hikeType is required');
            }

            return normalizedHikeType;
          })()
        : (campaign.hikeType ?? 'group');

    if (nextHikeType === 'group' && nextScheduleType === 'instant') {
      throw new BadRequestException(
        'Group campaigns must be scheduled at least 9 days in advance',
      );
    }

    let nextStartDate =
      dto.startDate !== undefined
        ? this.parseDateValue(dto.startDate)
        : (campaign.startDate ?? null);
    let nextJoinOpenDate =
      dto.joinOpenDate !== undefined
        ? this.parseDateValue(dto.joinOpenDate)
        : (campaign.joinOpenDate ?? null);
    const nextEndDate =
      dto.endDate !== undefined
        ? this.parseDateValue(dto.endDate)
        : (campaign.endDate ?? null);

    if (nextScheduleType === 'instant') {
      nextStartDate =
        campaign.scheduleType === 'instant' && campaign.startDate
          ? campaign.startDate
          : new Date();
      nextJoinOpenDate = nextStartDate;
    } else {
      if (!nextStartDate) {
        throw new BadRequestException(
          'startDate is required for scheduled campaigns',
        );
      }

      nextJoinOpenDate ??=
        nextHikeType === 'group' ? new Date() : nextStartDate;
    }

    if (nextHikeType === 'group' && campaign.lifecyclePhase === 'open') {
      nextJoinOpenDate = new Date();
    }

    const resolvedEndDate =
      nextScheduleType === 'instant'
        ? this.getInstantCampaignEndDate(nextStartDate)
        : nextEndDate;

    const scheduleWasChanged =
      (dto.scheduleType !== undefined &&
        nextScheduleType !== campaign.scheduleType) ||
      (dto.startDate !== undefined &&
        nextStartDate?.getTime() !== campaign.startDate?.getTime()) ||
      (dto.hikeType !== undefined && nextHikeType !== campaign.hikeType);

    if (
      scheduleWasChanged &&
      nextHikeType === 'group' &&
      nextStartDate &&
      nextStartDate.getTime() < this.getMinimumUserStartDate('group').getTime()
    ) {
      throw new BadRequestException(
        'Group campaigns must be scheduled at least 9 days in advance',
      );
    }

    if (
      !isAdmin &&
      scheduleWasChanged &&
      nextScheduleType === 'scheduled' &&
      nextHikeType !== 'group' &&
      nextStartDate &&
      nextStartDate.getTime() <
        this.getMinimumUserStartDate(nextHikeType).getTime()
    ) {
      throw new BadRequestException(
        'User campaigns must be scheduled at least 2 days in advance',
      );
    }

    this.validateTiming(nextStartDate, resolvedEndDate, nextJoinOpenDate);

    const nextMaxParticipants =
      dto.maxParticipants !== undefined
        ? Math.max(1, Number(dto.maxParticipants))
        : Math.max(1, Number(campaign.maxParticipants ?? 1));
    const nextMinParticipants =
      dto.minParticipants !== undefined
        ? Math.max(1, Number(dto.minParticipants))
        : Math.max(
            1,
            Number(
              campaign.minParticipants ?? (nextHikeType === 'group' ? 2 : 1),
            ),
          );
    if (nextMinParticipants > nextMaxParticipants) {
      throw new BadRequestException(
        'minParticipants cannot be greater than maxParticipants',
      );
    }

    const {
      startDate: _startDate,
      endDate: _endDate,
      joinOpenDate: _joinOpenDate,
      scheduleType: _scheduleType,
      category: _category,
      subcategory: _subcategory,
      hikeType: _hikeType,
      province,
      district,
      municipality,
      placeName,
      location,
      ...rest
    } = dto;

    const nextProvince =
      dto.province !== undefined
        ? this.normalizeLocationPart(province)
        : this.normalizeLocationPart(campaign.province ?? null);
    const nextDistrict =
      dto.district !== undefined
        ? this.normalizeLocationPart(district)
        : this.normalizeLocationPart(campaign.district ?? null);
    const nextMunicipality =
      dto.municipality !== undefined
        ? this.normalizeLocationPart(municipality)
        : this.normalizeLocationPart((campaign as any).municipality ?? null);
    const nextPlaceName =
      dto.placeName !== undefined
        ? this.normalizeLocationPart(placeName)
        : this.normalizeLocationPart(campaign.placeName ?? null);

    const nextLocation =
      dto.location !== undefined
        ? (this.normalizeLocationPart(location) ??
          this.buildDisplayLocation(
            nextProvince,
            nextDistrict,
            nextMunicipality,
            nextPlaceName,
          ))
        : (this.normalizeLocationPart(campaign.location ?? null) ??
          this.buildDisplayLocation(
            nextProvince,
            nextDistrict,
            nextMunicipality,
            nextPlaceName,
          ));

    const reviewSensitiveChanged =
      (dto.title !== undefined && dto.title.trim() !== campaign.title) ||
      (dto.description !== undefined &&
        dto.description.trim() !== (campaign.description ?? '')) ||
      (dto.difficulty !== undefined &&
        dto.difficulty !== campaign.difficulty) ||
      nextActivity.category !== campaign.category ||
      nextActivity.subcategory !== campaign.subcategory ||
      nextHikeType !== campaign.hikeType ||
      nextProvince !== campaign.province ||
      nextDistrict !== campaign.district ||
      nextMunicipality !== (campaign as any).municipality ||
      nextPlaceName !== campaign.placeName ||
      scheduleWasChanged ||
      (dto.photos !== undefined &&
        JSON.stringify(dto.photos) !== JSON.stringify(campaign.photos ?? []));

    Object.assign(campaign, rest);
    campaign.location = nextLocation;
    campaign.province = nextProvince;
    campaign.district = nextDistrict;
    (campaign as any).municipality = nextMunicipality;
    campaign.placeName = nextPlaceName;
    campaign.category = nextActivity.category;
    campaign.subcategory = nextActivity.subcategory;
    campaign.hikeType = nextHikeType;
    campaign.genderVisibility =
      nextHikeType === 'group'
        ? (dto.genderVisibility ?? campaign.genderVisibility ?? 'all')
        : 'all';
    campaign.visibility =
      nextHikeType === 'group'
        ? (dto.visibility ?? campaign.visibility ?? 'public')
        : 'public';
    campaign.scheduleType = nextScheduleType;
    campaign.startDate = nextStartDate;
    campaign.endDate = resolvedEndDate;
    campaign.joinOpenDate = nextJoinOpenDate;
    campaign.maxParticipants = nextMaxParticipants;
    campaign.minParticipants =
      nextHikeType === 'group' ? nextMinParticipants : 1;

    if (nextHikeType === 'group' && nextStartDate) {
      const createdAt = campaign.timeline?.createdAt
        ? new Date(campaign.timeline.createdAt)
        : new Date();
      const timeline = this.calculateGroupTimeline(nextStartDate, createdAt);
      campaign.timeline = campaign.timeline ?? {};
      campaign.timeline.createdAt = createdAt;
      campaign.timeline.openAt = timeline.openAt;
      campaign.timeline.planningAt = timeline.planningAt;
      campaign.timeline.verificationAt = timeline.verificationAt;
      campaign.timeline.readyAt = timeline.readyAt;
      if (campaign.lifecyclePhase === 'open') {
        campaign.timeline.nextTransitionAt = timeline.planningAt;
      } else if (campaign.lifecyclePhase === 'planning') {
        campaign.timeline.nextTransitionAt = timeline.verificationAt;
      } else if (campaign.lifecyclePhase === 'verification') {
        campaign.timeline.nextTransitionAt = timeline.readyAt;
      } else if (campaign.lifecyclePhase === 'ready') {
        campaign.timeline.nextTransitionAt = nextStartDate;
      }
    } else if (nextStartDate) {
      campaign.timeline = campaign.timeline ?? {};
      campaign.timeline.readyAt = new Date(
        nextStartDate.getTime() - CampaignService.DAY_MS,
      );
      if (campaign.lifecyclePhase === 'ready') {
        campaign.timeline.nextTransitionAt = nextStartDate;
      }
    }

    if (
      !isAdmin &&
      campaign.lifecyclePhase !== 'started' &&
      (campaign.approvalStatus !== 'approved' || reviewSensitiveChanged)
    ) {
      const requiresAdminApproval = await this.getDifficultyApprovalRequirement(
        campaign.difficulty,
      );

      if (nextScheduleType === 'instant' && requiresAdminApproval) {
        throw new BadRequestException(
          'Instant solo trips are available only for difficulties that do not require admin approval',
        );
      }

      campaign.approvalStatus = requiresAdminApproval
        ? 'submitted'
        : 'approved';
      campaign.submittedAt = requiresAdminApproval ? new Date() : null;
      campaign.approvedAt = null;
      campaign.approvedBy = null;
      campaign.rejectedAt = null;
      campaign.rejectedBy = null;
      campaign.approvalNote = null;
    }

    this.recomputePlanningCost(campaign);
    this.evaluatePlanningCompleteness(campaign);
    campaign.lastPlanningActivityAt = new Date();

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
      throw new BadRequestException(
        'Completed campaigns cannot be submitted for review',
      );
    }

    if (campaign.approvalStatus === 'approved') {
      throw new BadRequestException('Campaign is already approved');
    }

    if (campaign.approvalStatus === 'submitted') {
      throw new BadRequestException('Campaign is already submitted for review');
    }

    const requiresAdminApproval = await this.getDifficultyApprovalRequirement(
      campaign.difficulty,
    );
    const now = new Date();

    campaign.approvalStatus = requiresAdminApproval ? 'submitted' : 'approved';
    campaign.submittedAt = requiresAdminApproval ? now : null;
    campaign.approvedAt = requiresAdminApproval ? null : now;
    campaign.approvedBy =
      !requiresAdminApproval && isAdmin
        ? new Types.ObjectId(requesterId)
        : null;
    campaign.rejectedAt = null;
    campaign.rejectedBy = null;
    campaign.approvalNote = null;

    if (!requiresAdminApproval) {
      if (campaign.hikeType === 'group') {
        if (campaign.lifecyclePhase === 'draft') {
          campaign.lifecyclePhase = 'open';
        }
        if (campaign.timeline?.planningAt) {
          campaign.timeline.nextTransitionAt = campaign.timeline.planningAt;
        }
      } else {
        campaign.lifecyclePhase =
          campaign.lifecyclePhase === 'draft'
            ? 'ready'
            : campaign.lifecyclePhase;
        campaign.timeline = campaign.timeline ?? {};
        campaign.timeline.nextTransitionAt = campaign.startDate ?? null;
      }
    }

    await campaign.save();

    await this.audit.logEvent({
      type: requiresAdminApproval ? 'campaign.submit' : 'campaign.auto_approve',
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

    if (campaign.hikeType === 'group') {
      campaign.lifecyclePhase =
        campaign.lifecyclePhase === 'draft' ? 'open' : campaign.lifecyclePhase;
      campaign.timeline = campaign.timeline ?? {};
      campaign.timeline.nextTransitionAt =
        campaign.timeline.planningAt ??
        campaign.timeline.nextTransitionAt ??
        null;
    } else {
      campaign.lifecyclePhase =
        campaign.lifecyclePhase === 'draft' ? 'ready' : campaign.lifecyclePhase;
      campaign.timeline = campaign.timeline ?? {};
      campaign.timeline.nextTransitionAt = campaign.startDate ?? null;
    }

    await campaign.save();

    await this.notifyParticipants(
      campaign,
      'Campaign approved',
      `Campaign "${campaign.title}" has been approved.`,
      { campaignId: campaign._id.toString(), phase: campaign.lifecyclePhase },
    );

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
    campaign.lifecyclePhase = 'draft';
    campaign.timeline = campaign.timeline ?? {};
    campaign.timeline.nextTransitionAt = null;
    await campaign.save();

    await this.notifyParticipants(
      campaign,
      'Campaign rejected',
      `Campaign "${campaign.title}" was rejected: ${normalizedReason}`,
      { campaignId: campaign._id.toString(), phase: campaign.lifecyclePhase },
    );

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
    if (campaign.deletedByAdmin) {
      return { message: 'Campaign is already in bin' };
    }

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

  async deleteOwnCampaign(id: string, requesterId: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign || campaign.deletedByAdmin) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.hostId.toString() !== requesterId) {
      throw new ForbiddenException('Only the campaign owner can delete it');
    }
    await this.campaignModel.findByIdAndDelete(id);
    await this.audit.logEvent({
      type: 'campaign.delete_by_owner',
      campaignId: id,
      requesterId,
    });
    return { message: 'Campaign deleted' };
  }

  async restoreDeletedCampaign(id: string, adminId: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.deletedByAdmin) {
      throw new BadRequestException('Campaign is not in bin');
    }

    campaign.deletedByAdmin = false;
    await campaign.save();

    await this.audit.logEvent({
      type: 'campaign.restore_by_admin',
      campaignId: id,
      adminId,
    });

    return this.getCampaignById(id);
  }

  async hardDeleteCampaign(id: string, adminId: string, reason?: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.deletedByAdmin) {
      throw new BadRequestException(
        'Move campaign to bin before permanent delete',
      );
    }

    await this.campaignModel.findByIdAndDelete(id);
    await this.audit.logEvent({
      type: 'campaign.hard_delete',
      campaignId: id,
      adminId,
      reason: reason?.trim() || null,
    });
    return { message: 'Campaign permanently removed' };
  }
}
