import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignDocument = Campaign & Document;

export type CampaignLifecyclePhase =
  | 'draft'
  | 'open'
  | 'planning'
  | 'verification'
  | 'ready'
  | 'started'
  | 'completed'
  | 'cancelled';

export type CampaignParticipantRole = 'host' | 'co-host' | 'member';

export class CampaignParticipant {
  userId!: Types.ObjectId;
  status!: 'pending' | 'accepted' | 'rejected' | 'left' | 'removed';
  role!: CampaignParticipantRole;
  joinedAt?: Date | null;
  leftAt?: Date | null;
  confirmed!: boolean;
  confirmedAt?: Date | null;
  dropoutFlag?: boolean;
  verified?: boolean;
  completionDays?: number | null;
}

export class CampaignPhoto {
  url!: string;
  publicId?: string | null;
  caption?: string | null;
}

export type CampaignApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type CampaignAdminVerificationStatus = 'pending' | 'approved' | 'rejected';

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ type: String, required: true, unique: true, index: true })
  campaignCode!: string;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: String, default: null })
  location?: string | null;

  @Prop({ type: String, default: null })
  province?: string | null;

  @Prop({ type: String, default: null })
  district?: string | null;

  @Prop({ type: String, default: null })
  municipality?: string | null;

  @Prop({ type: String, default: null })
  placeName?: string | null;

  @Prop({ type: String, default: null })
  difficulty?: string | null;

  @Prop({ type: String, required: true, default: null })
  category!: string;

  @Prop({ type: String, default: null })
  subcategory?: string | null;

  @Prop({ type: String, enum: ['solo', 'group'], required: true, default: 'group' })
  hikeType!: 'solo' | 'group';

  @Prop({ type: Number, default: 1 })
  durationDays!: number;

  @Prop({ type: Number, default: 1 })
  maxParticipants!: number;

  @Prop({ type: Number, default: 1 })
  minParticipants!: number;

  @Prop({ type: Number, default: 0 })
  estimatedNPR!: number;

  @Prop({ type: String, enum: ['instant', 'scheduled'], default: 'scheduled' })
  scheduleType!: 'instant' | 'scheduled';

  @Prop({ type: Date, default: null })
  startDate?: Date | null;

  @Prop({ type: Date, default: null })
  endDate?: Date | null;

  @Prop({ type: Date, default: null })
  joinOpenDate?: Date | null;

  @Prop({ type: String, enum: ['open', 'request'], default: 'open' })
  joinMode!: 'open' | 'request';

  @Prop({
    type: String,
    enum: ['draft', 'open', 'planning', 'verification', 'ready', 'started', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  })
  lifecyclePhase!: CampaignLifecyclePhase;

  @Prop({ type: Boolean, default: false })
  phaseLocked!: boolean;

  @Prop({ type: Number, default: 0 })
  phaseVersion!: number;

  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true })
  hostId!: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: Types.ObjectId,
        status: String,
        role: String,
        joinedAt: Date,
        leftAt: Date,
        confirmed: Boolean,
        confirmedAt: Date,
        dropoutFlag: Boolean,
        verified: Boolean,
        completionDays: Number,
      },
    ],
    default: [],
  })
  participants!: CampaignParticipant[];

  @Prop({ type: Boolean, default: false })
  participantsLocked!: boolean;

  @Prop({
    type: {
      createdAt: Date,
      openAt: Date,
      planningAt: Date,
      verificationAt: Date,
      readyAt: Date,
      startedAt: Date,
      completedAt: Date,
      cancelledAt: Date,
      nextTransitionAt: Date,
    },
    default: {},
  })
  timeline?: {
    createdAt?: Date | null;
    openAt?: Date | null;
    planningAt?: Date | null;
    verificationAt?: Date | null;
    readyAt?: Date | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    nextTransitionAt?: Date | null;
  };

  @Prop({
    type: {
      transportDecision: String,
      meetingPoint: String,
      meetingTime: Date,
      costBreakdown: {
        transport: Number,
        food: Number,
        guide: Number,
        misc: Number,
        totalCost: { type: Number, default: 0 },
        costPerPerson: { type: Number, default: 0 },
      },
      tasks: [
        {
          title: String,
          assignedUserId: Types.ObjectId,
          completed: { type: Boolean, default: false },
          completedAt: Date,
        },
      ],
      isComplete: { type: Boolean, default: false },
      completenessErrors: { type: [String], default: [] },
      lastUpdatedAt: Date,
    },
    default: {
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
    },
  })
  planning?: {
    transportDecision?: string | null;
    meetingPoint?: string | null;
    meetingTime?: Date | null;
    costBreakdown?: {
      transport?: number;
      food?: number;
      guide?: number;
      misc?: number;
      totalCost: number;
      costPerPerson: number;
    };
    tasks?: Array<{
      _id?: Types.ObjectId;
      title: string;
      assignedUserId?: Types.ObjectId | null;
      completed: boolean;
      completedAt?: Date | null;
    }>;
    isComplete: boolean;
    completenessErrors: string[];
    lastUpdatedAt?: Date | null;
  };

  @Prop({
    type: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      reviewedBy: Types.ObjectId,
      reviewedAt: Date,
      rejectionReason: String,
    },
    default: { status: 'pending' },
  })
  adminVerification?: {
    status: CampaignAdminVerificationStatus;
    reviewedBy?: Types.ObjectId | null;
    reviewedAt?: Date | null;
    rejectionReason?: string | null;
  };

  @Prop({ type: Date, default: null })
  lastPlanningActivityAt?: Date | null;

  @Prop({ type: Number, default: 0 })
  hostInactivityReminderCount!: number;

  @Prop({ type: String, default: null })
  cancellationReason?: string | null;

  @Prop({
    type: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],
    default: [],
  })
  photos!: CampaignPhoto[];

  @Prop({ type: Boolean, default: false })
  deletedByAdmin!: boolean;

  @Prop({ type: Boolean, default: false })
  completed!: boolean;

  @Prop({ type: Boolean, default: false })
  hostVerified!: boolean;

  @Prop({
    type: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],
    default: [],
  })
  verificationPhotos!: CampaignPhoto[];

  @Prop({ type: Date, default: null })
  verificationDeadline?: Date | null;

  @Prop({ type: Boolean, default: false })
  awaitingVerification!: boolean;

  @Prop({ type: Date, default: null })
  verifiedAt?: Date | null;

  @Prop({ type: Boolean, default: false })
  failed!: boolean;

  @Prop({ type: Date, default: null })
  failedAt?: Date | null;

  @Prop({ type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft', index: true })
  approvalStatus!: CampaignApprovalStatus;

  @Prop({ type: Date, default: null })
  submittedAt?: Date | null;

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Auth', default: null })
  approvedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  rejectedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Auth', default: null })
  rejectedBy?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  approvalNote?: string | null;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
