import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class VisitedPlace extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  placeCode: string; // e.g., 'kathmandu', 'bhaktapur'

  @Prop({
    type: String,
    required: true,
    enum: ['district', 'province'],
  })
  placeType: string;

  @Prop({ type: Date, required: true })
  visitedAt: Date;

  @Prop({ type: Number, default: 1, min: 1 })
  visitCount: number;

  @Prop({ type: [String], default: [] })
  sourceCampaignIds: string[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const VisitedPlaceSchema = SchemaFactory.createForClass(VisitedPlace);

// Unique constraint: one entry per user per place
VisitedPlaceSchema.index({ userId: 1, placeCode: 1 }, { unique: true });
VisitedPlaceSchema.index({ userId: 1, placeType: 1 });
