import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TripParticipant extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Trip', index: true })
  tripId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected', 'removed'],
    default: 'pending',
  })
  status: string;

  @Prop({ default: false })
  completionConfirmed: boolean;

  @Prop({ nullable: true })
  joinedAt: Date;

  @Prop({ nullable: true })
  lastCheckinAt: Date;

  @Prop({ default: 0 })
  missedCheckins: number;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const TripParticipantSchema =
  SchemaFactory.createForClass(TripParticipant);

// Unique index to prevent duplicate membership
TripParticipantSchema.index(
  { tripId: 1, userId: 1 },
  { unique: true, name: 'unique_membership' },
);
TripParticipantSchema.index({ userId: 1, status: 1 }, { name: 'user_status' });
TripParticipantSchema.index({ tripId: 1, status: 1 }, { name: 'trip_status' });
TripParticipantSchema.index({ lastCheckinAt: 1 }, { name: 'checkin_cron' });
