import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserRankUpAchievement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RankUpAchievement', required: true })
  rankUpAchievementId: Types.ObjectId;

  // Progress Tracking
  @Prop({ type: Number, default: 0 })
  progress: number; // Current value of conditionField for this user

  @Prop({ type: Boolean, default: false })
  isCompleted: boolean; // Achievement unlocked

  @Prop({ type: Date })
  completedAt: Date; // When achievement was unlocked

  // Repeatable Achievement Tracking
  @Prop({ type: Number, default: 0 })
  timesCompleted: number; // How many times user has unlocked this achievement

  @Prop({ type: Date })
  lastCompletedAt: Date; // Last time achievement was unlocked

  // Which rank was this completed for
  @Prop({ type: String, enum: ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] })
  rankedUpTo: string; // Which rank did user achieve by completing this

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const UserRankUpAchievementSchema = SchemaFactory.createForClass(
  UserRankUpAchievement,
);

// Indexes for efficient querying
UserRankUpAchievementSchema.index(
  { userId: 1, rankUpAchievementId: 1 },
  { unique: true },
);
UserRankUpAchievementSchema.index({ userId: 1, isCompleted: 1 });
UserRankUpAchievementSchema.index({ userId: 1, rankedUpTo: 1 });
UserRankUpAchievementSchema.index({ userId: 1 });
UserRankUpAchievementSchema.index({ isCompleted: 1 });
