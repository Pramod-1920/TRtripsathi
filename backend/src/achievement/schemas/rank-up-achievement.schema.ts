import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RankUpAchievement extends Document {
  @Prop({ type: String, required: true, unique: true })
  code: string; // e.g., 'RANK_B_TO_A_HIKE_MASTER', 'RANK_A_TO_S_TREK_50'

  @Prop({ type: String, required: true })
  name: string; // Human-readable name

  @Prop({ type: String })
  description: string; // What player must do to unlock for rank-up

  // Rank Progression Fields
  @Prop({
    type: String,
    required: true,
    enum: ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'],
  })
  targetRank: string; // Which rank this achievement unlocks (e.g., 'A' to rank up to A)

  // Activity Types - Link to activities
  @Prop({
    type: [String],
    required: true,
    enum: [
      'hike',
      'trek',
      'heritage',
      'natural_resource',
      'adventure',
      'hidden_gems',
    ],
  })
  activityTypes: string[]; // Activities this achievement is related to

  // Condition Logic
  @Prop({
    type: String,
    required: true,
    enum: ['count', 'value', 'event'],
  })
  conditionType: string; // How to measure progress

  @Prop({ type: String, required: true })
  conditionField: string; // User field to track (e.g., 'hikes', 'xp', 'level')

  @Prop({
    type: String,
    default: 'gte',
    enum: ['gte', 'eq', 'lte', 'gt', 'lt'],
  })
  conditionOperator: string; // Comparison operator

  @Prop({ type: Number, required: true })
  conditionValue: number; // Target value or count

  // Optional Filtering
  @Prop({ type: String })
  filterField: string; // e.g., 'difficulty' – additional filter

  @Prop({ type: String })
  filterValue: string; // e.g., 'expert' – only count expert difficulty

  // Minimum Requirements
  @Prop({ type: Number, required: true })
  minLevel: number; // Minimum level required to unlock rank

  @Prop({ type: Number, default: 0 })
  minXp: number; // Minimum XP needed

  // Rewards
  @Prop({ type: Number, default: 0 })
  xpReward: number; // XP awarded on unlock

  @Prop({ type: String })
  badgeCode: string; // Badge identifier (e.g., 'RANK_A_BADGE')

  // Lifecycle
  @Prop({ type: Boolean, default: true })
  isActive: boolean; // Inactive achievements not offered to players

  @Prop({ type: Boolean, default: false })
  isRepeatable: boolean; // Can be unlocked multiple times

  @Prop({ type: Number })
  maxCompletions: number; // Max times it can be unlocked (null = unlimited)

  // Metadata
  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true })
  createdBy: Types.ObjectId; // Admin user who created it

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const RankUpAchievementSchema =
  SchemaFactory.createForClass(RankUpAchievement);

// Indexes for efficient querying
RankUpAchievementSchema.index({ isActive: 1 });
RankUpAchievementSchema.index({ targetRank: 1 });
RankUpAchievementSchema.index({ isActive: 1, targetRank: 1 });
RankUpAchievementSchema.index({ activityTypes: 1 });
RankUpAchievementSchema.index({ targetRank: 1, activityTypes: 1 });
