import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Trip extends Document {
  @Prop({ required: true, unique: true, index: true })
  tripCode: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Auth' })
  hostId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ nullable: true })
  description: string;

  @Prop({
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
  activityType: string;

  @Prop({ required: true, enum: ['easy', 'moderate', 'difficult', 'expert'] })
  difficulty: string;

  @Prop({
    required: true,
    enum: ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: string;

  @Prop({
    required: true,
    enum: ['open', 'approval_required'],
    default: 'open',
  })
  joinMode: string;

  @Prop({ required: true, min: 2, max: 30 })
  maxParticipants: number;

  @Prop({ default: 1 })
  currentParticipantCount: number;

  @Prop({ default: false })
  waitlistEnabled: boolean;

  @Prop({ default: 0 })
  waitlistCount: number;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ nullable: true })
  endDate: Date;

  @Prop({ nullable: true })
  joinOpenUntil: Date;

  @Prop({ nullable: true })
  province: string;

  @Prop({ nullable: true })
  district: string;

  // GeoJSON Point for geospatial queries
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  })
  locationGps: {
    type: string;
    coordinates: [number, number];
  };

  @Prop({ type: [String], maxlength: 5 })
  tags: string[];

  @Prop({ default: false, note: 'prevents double-award of XP' })
  xpAwarded: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ nullable: true })
  cancellationReason: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const TripSchema = SchemaFactory.createForClass(Trip);

// Create 2dsphere index for geospatial queries
TripSchema.index({ locationGps: '2dsphere' });
TripSchema.index({ status: 1, startDate: 1 }, { name: 'status_start' });
TripSchema.index({ hostId: 1 });
TripSchema.index(
  { activityType: 1, difficulty: 1, status: 1 },
  { name: 'discovery' },
);
TripSchema.index({ district: 1, status: 1 }, { name: 'district_search' });
TripSchema.index(
  { isDeleted: 1, status: 1, startDate: 1 },
  { name: 'soft_delete_aware' },
);
