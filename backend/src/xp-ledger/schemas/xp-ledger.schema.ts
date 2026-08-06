import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class XpLedger extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  xpAmount: number;

  @Prop({ type: Number, required: true, note: 'XP balance after this event' })
  balanceAfter: number;

  @Prop({
    type: String,
    required: true,
    enum: [
      'trip_completion',
      'review_received',
      'achievement_unlock',
      'hosting_trip',
      'level_milestone',
      'admin_award',
      'admin_deduct',
    ],
  })
  eventCode: string;

  @Prop({ type: String, maxlength: 500 })
  description: string;

  @Prop({ type: Object })
  metadata: Record<string, any>; // tripId, achievementId, etc.

  @Prop({ type: Types.ObjectId, ref: 'User', nullable: true })
  awardedBy: Types.ObjectId; // Admin who awarded/deducted

  @Prop({ type: Boolean, default: false })
  isReversed: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const XpLedgerSchema = SchemaFactory.createForClass(XpLedger);

// Indexes
XpLedgerSchema.index({ userId: 1, createdAt: -1 });
XpLedgerSchema.index({ userId: 1, eventCode: 1 });
XpLedgerSchema.index({ awardedBy: 1, createdAt: -1 });
