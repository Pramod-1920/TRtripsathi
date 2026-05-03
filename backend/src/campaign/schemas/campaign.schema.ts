import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignDocument = Campaign & Document;

export class CampaignParticipant {
  userId!: Types.ObjectId;
  status!: 'pending' | 'accepted' | 'rejected';
  verified?: boolean;
  completionDays?: number | null;
}

export class CampaignPhoto {
  url!: string;
  publicId?: string | null;
  caption?: string | null;
}

export type CampaignApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

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
  placeName?: string | null;

  @Prop({ type: String, default: null })
  difficulty?: string | null;

  @Prop({ type: String, required: true, default: null })
  category!: string;

  @Prop({ type: String, enum: ['solo', 'group'], required: true, default: 'group' })
  hikeType!: 'solo' | 'group';

  @Prop({ type: Number, default: 1 })
  durationDays!: number;

  @Prop({ type: Number, default: 1 })
  maxParticipants!: number;

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

  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true })
  hostId!: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: Types.ObjectId,
        status: String,
        verified: Boolean,
        completionDays: Number,
      },
    ],
    default: [],
  })
  participants!: CampaignParticipant[];

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
