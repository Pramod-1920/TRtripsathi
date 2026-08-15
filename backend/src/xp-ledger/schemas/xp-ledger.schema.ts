import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class XpLedger extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  xpAmount: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    note: 'XP balance after this event',
  })
  balanceAfter: number;

  @Prop({ type: String, required: true, index: true })
  eventCode: string;

  @Prop({ type: String, default: null })
  contextKey?: string | null;

  @Prop({ type: String, maxlength: 500 })
  description: string;

  @Prop({ type: Object })
  metadata: Record<string, any>; // tripId, achievementId, etc.

  @Prop({ type: Types.ObjectId, ref: 'User', nullable: true })
  awardedBy?: Types.ObjectId | null; // Admin who awarded/deducted

  @Prop({ type: Boolean, default: false })
  isReversed: boolean;

  @Prop({ type: Date, default: null })
  appliedAt?: Date | null;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const XpLedgerSchema = SchemaFactory.createForClass(XpLedger);

// Indexes
XpLedgerSchema.index({ userId: 1, createdAt: -1 });
XpLedgerSchema.index({ userId: 1, eventCode: 1 });
XpLedgerSchema.index({ awardedBy: 1, createdAt: -1 });
XpLedgerSchema.index(
  { userId: 1, contextKey: 1 },
  {
    unique: true,
    partialFilterExpression: { contextKey: { $type: 'string' } },
  },
);
