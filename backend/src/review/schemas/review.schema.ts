import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Review extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  revieweeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Trip', required: true })
  tripId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number; // 1.0 to 5.0

  @Prop({ type: String, maxlength: 500 })
  comment: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Unique constraint: one review per reviewer per reviewee per trip
ReviewSchema.index(
  { reviewerId: 1, revieweeId: 1, tripId: 1 },
  { unique: true }
);

// For fetching all reviews for a user
ReviewSchema.index({ revieweeId: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1 });
