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
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
