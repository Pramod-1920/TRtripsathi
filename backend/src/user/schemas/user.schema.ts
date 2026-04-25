import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExperienceLevel } from '../../auth/constants/experience-level.enum';
import { Gender } from '../constants/gender.enum';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: Types.ObjectId, required: true, unique: true, ref: 'Auth' })
  authId!: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  profileCompleted!: boolean;

  @Prop({ type: Number, default: 0 })
  xp!: number;

  @Prop({ type: Number, default: 1 })
  level!: number;

  @Prop({
    type: {
      hikes: { type: Number, default: 0 },
      treks: { type: Number, default: 0 },
      temples: { type: Number, default: 0 },
      difficultRoutes: { type: Number, default: 0 },
      legendaryRoutes: { type: Number, default: 0 },
      questChains: { type: Number, default: 0 },
    },
    default: {},
  })
  achievementStats?: {
    hikes?: number;
    treks?: number;
    temples?: number;
    difficultRoutes?: number;
    legendaryRoutes?: number;
    questChains?: number;
  };

  @Prop({
    type: [
      {
        key: String,
        title: String,
        subcategory: String,
        count: Number,
        target: Number,
        rewardXp: Number,
        hidden: Boolean,
        completedAt: Date,
        updatedAt: Date,
      },
    ],
    default: [],
  })
  achievementProgress?: Array<{
    key: string;
    title: string;
    subcategory: string;
    count: number;
    target: number;
    rewardXp?: number;
    hidden?: boolean;
    completedAt?: Date;
    updatedAt?: Date;
  }>;

  @Prop({ type: Types.ObjectId, ref: 'Auth', default: null })
  referredByAuthId?: Types.ObjectId | null;

  @Prop({
    type: [
      {
        campaignId: String,
        raterAuthId: Types.ObjectId,
        rating: Number,
        comment: String,
        createdAt: Date,
      },
    ],
    default: [],
  })
  receivedRatings?: Array<{
    campaignId: string;
    raterAuthId: Types.ObjectId;
    rating: number;
    comment?: string;
    createdAt: Date;
  }>;

  @Prop({
    type: [
      {
        requestCode: String,
        campaignId: String,
        url: String,
        kind: String,
        status: String,
        submittedAt: Date,
        reviewedAt: Date,
        reviewedByAuthId: Types.ObjectId,
        reviewNote: String,
      },
    ],
    default: [],
  })
  photoVerificationRequests?: Array<{
    requestCode: string;
    campaignId: string;
    url: string;
    kind: 'group' | 'solo';
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: Date;
    reviewedAt?: Date;
    reviewedByAuthId?: Types.ObjectId;
    reviewNote?: string;
  }>;

  @Prop({
    type: [
      {
        eventKey: String,
        ruleCode: String,
        ruleName: String,
        points: Number,
        contextKey: String,
        context: Object,
        awardedAt: Date,
      },
    ],
    default: [],
  })
  xpHistory?: Array<{
    eventKey: string;
    ruleCode: string;
    ruleName: string;
    points: number;
    contextKey: string;
    context?: Record<string, unknown>;
    awardedAt: Date;
  }>;

  @Prop({ type: String, default: '' })
  badge!: string;

  @Prop({ type: Boolean, default: true })
  isProfilePublic!: boolean;

  @Prop({ type: String, default: null })
  firstName?: string | null;

  @Prop({ type: String, default: null })
  middleName?: string | null;

  @Prop({ type: String, default: null })
  lastName?: string | null;

  @Prop({ type: Date, default: null })
  dateOfBirth?: Date | null;

  @Prop({ type: Number, default: null })
  age?: number | null;

  @Prop({ type: String, default: null })
  profilePhoto?: string | null;

  @Prop({ type: String, default: null })
  profilePhotoPublicId?: string | null;

  @Prop({ type: String, default: null })
  bio?: string | null;

  @Prop({ type: String, default: null })
  location?: string | null;

  @Prop({ type: String, default: null })
  province?: string | null;

  @Prop({ type: String, default: null })
  district?: string | null;

  @Prop({ type: String, default: null })
  landmark?: string | null;

  @Prop({ type: String, default: ExperienceLevel.E })
  experienceLevel?: string | null;

  @Prop({ type: String, enum: Gender, default: null })
  gender?: Gender | null;

  @Prop({ type: [String], default: [] })
  languagesKnown?: string[];

  // Admin-imposed flags (not editable by the user directly)
  @Prop({
    type: [{ type: String, campaignId: String, reason: String, date: Date }],
    default: [],
  })
  adminFlags?: Array<{
    type: string;
    campaignId?: string;
    reason?: string;
    date: Date;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ profileCompleted: 1, isProfilePublic: 1 });
