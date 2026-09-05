import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AchievementDefinition extends Document {
  @Prop({ type: String, required: true, unique: true })
  code: string; // e.g., 'DISTRICT_10', 'HIKES_50', 'TREK_MASTER'

  @Prop({ type: String, required: true })
  name: string; // Human-readable name

  @Prop({ type: String })
  description: string; // What player must do to unlock

  @Prop({
    type: String,
    required: true,
    enum: ['exploration', 'hosting', 'skill', 'social', 'special'],
  })
  category: string;

  @Prop({ type: String })
  iconUrl: string; // Asset URL for achievement icon/badge

  // Condition Logic
  @Prop({
    type: String,
    required: true,
    enum: ['count', 'value', 'event'],
  })
  conditionType: string; // How to measure progress

  @Prop({ type: String, required: true })
  conditionField: string; // User field to track (e.g., 'districtsVisited', 'xp', 'level')

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
  filterField: string; // e.g., 'activityType' – filter achievements to specific conditions

  @Prop({ type: String })
  filterValue: string; // e.g., 'trek' – only count treks

  // Rewards
  @Prop({ type: Number, default: 0 })
  xpReward: number; // XP awarded on unlock

  @Prop({ type: String })
  badgeCode: string; // Badge identifier (e.g., 'EXPLORER_BADGE')

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

export const AchievementDefinitionSchema = SchemaFactory.createForClass(
  AchievementDefinition,
);

// Indexes
AchievementDefinitionSchema.index({ isActive: 1 });
AchievementDefinitionSchema.index({ category: 1 });
AchievementDefinitionSchema.index({ isActive: 1, category: 1 });
