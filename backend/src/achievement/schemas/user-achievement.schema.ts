import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserAchievement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AchievementDefinition', required: true })
  achievementId: Types.ObjectId;

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

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const UserAchievementSchema =
  SchemaFactory.createForClass(UserAchievement);

// Indexes
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, isCompleted: 1 });
UserAchievementSchema.index({ userId: 1 });
UserAchievementSchema.index({ isCompleted: 1 });
