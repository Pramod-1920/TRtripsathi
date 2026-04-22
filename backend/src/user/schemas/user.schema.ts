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

  @Prop({ type: String, enum: ExperienceLevel, default: null })
  experienceLevel?: ExperienceLevel | null;

  @Prop({ type: String, enum: Gender, default: null })
  gender?: Gender | null;

  @Prop({ type: [String], default: [] })
  languagesKnown?: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ profileCompleted: 1, isProfilePublic: 1 });
