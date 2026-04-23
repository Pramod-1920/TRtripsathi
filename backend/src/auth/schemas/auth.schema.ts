import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../constants/roles.enum';

@Schema({ timestamps: true })
export class Auth extends Document {
  @Prop({ type: String, required: true, unique: true })
  phoneNumber!: string;

  @Prop({ type: String, default: null, unique: true, sparse: true })
  email?: string | null;

  @Prop({ type: String, required: true })
  password!: string;

  @Prop({ type: String, enum: Role, default: Role.User, required: true })
  role!: Role;

  // Support multiple active refresh token hashes (for concurrent sessions)
  @Prop({ type: [{ hash: String, createdAt: Date }], default: [] })
  refreshTokens?: Array<{ hash: string; createdAt: Date }>;

  @Prop({ type: Number, default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockUntil?: Date | null;
}

export const AuthSchema = SchemaFactory.createForClass(Auth);
