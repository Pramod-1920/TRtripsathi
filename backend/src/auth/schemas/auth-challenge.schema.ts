import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthChallengeDocument = HydratedDocument<AuthChallenge>;
export type AuthChallengePurpose =
  | 'verify_email'
  | 'verify_phone'
  | 'reset_password';
export type AuthChallengeChannel = 'email' | 'sms';

@Schema({ timestamps: true })
export class AuthChallenge {
  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true, index: true })
  authId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['verify_email', 'verify_phone', 'reset_password'],
    required: true,
    index: true,
  })
  purpose!: AuthChallengePurpose;

  @Prop({ type: String, enum: ['email', 'sms'], required: true })
  channel!: AuthChallengeChannel;

  @Prop({ type: String, required: true })
  destinationHash!: string;

  @Prop({ type: String, required: true })
  codeHash!: string;

  @Prop({ type: Number, default: 5 })
  attemptsRemaining!: number;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, required: true })
  resendAvailableAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt?: Date | null;

  @Prop({ type: String, default: null })
  requestIpHash?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AuthChallengeSchema = SchemaFactory.createForClass(AuthChallenge);

AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthChallengeSchema.index({ authId: 1, purpose: 1, createdAt: -1 });
