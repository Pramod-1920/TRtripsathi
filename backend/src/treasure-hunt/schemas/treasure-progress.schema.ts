import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TreasureProgress extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TreasureHunt', required: true })
  treasureHuntId: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        waypointOrder: Number,
        completedAt: Date,
      },
    ],
    default: [],
  })
  completedWaypoints: Array<{
    waypointOrder: number;
    completedAt: Date;
  }>;

  @Prop({ type: Boolean, default: false })
  isWinner: boolean; // All waypoints completed

  @Prop({ type: Date })
  completedAt: Date; // When all waypoints were completed

  @Prop({ type: Number })
  timeToCompleteMinutes: number;

  @Prop({ type: Boolean, default: false })
  xpAwarded: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const TreasureProgressSchema = SchemaFactory.createForClass(TreasureProgress);

// Indexes
TreasureProgressSchema.index({ userId: 1, treasureHuntId: 1 }, { unique: true });
TreasureProgressSchema.index({ treasureHuntId: 1, isWinner: 1 });
TreasureProgressSchema.index({ completedAt: 1 });
TreasureProgressSchema.index({ userId: 1, createdAt: -1 });
