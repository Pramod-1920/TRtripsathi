import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserBadge extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  badgeCode: string; // e.g., 'host_master', 'explorer_50', 'trusted_5_star'

  @Prop({
    type: String,
    required: true,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'rank'],
  })
  tier: string;

  @Prop({ type: String })
  name: string; // Display name

  @Prop({ type: String })
  description: string; // Badge description

  @Prop({ type: String })
  iconUrl: string; // URL to badge icon

  @Prop({ type: Date, required: true })
  unlockedAt: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const UserBadgeSchema = SchemaFactory.createForClass(UserBadge);

// Unique: one badge per user
UserBadgeSchema.index({ userId: 1, badgeCode: 1 }, { unique: true });
UserBadgeSchema.index({ userId: 1, tier: 1 });
UserBadgeSchema.index({ badgeCode: 1, unlockedAt: -1 });
