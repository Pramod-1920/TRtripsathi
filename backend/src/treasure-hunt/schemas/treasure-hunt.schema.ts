import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TreasureHunt extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Trip', nullable: true })
  tripId: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        order: Number,
        clue: String,
        location: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: [Number], // [longitude, latitude]
        },
        radius: Number, // meters
        hint: String,
      },
    ],
    required: true,
  })
  waypoints: Array<{
    order: number;
    clue: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
    radius: number;
    hint?: string;
  }>;

  @Prop({
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard', 'expert'],
  })
  difficulty: string;

  @Prop({ type: Number })
  estimatedDurationMinutes: number;

  @Prop({ type: Number, default: 0 })
  xpReward: number;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const TreasureHuntSchema = SchemaFactory.createForClass(TreasureHunt);

// Create 2dsphere index for geospatial queries on waypoint locations
TreasureHuntSchema.index({ 'waypoints.location': '2dsphere' });
TreasureHuntSchema.index({ tripId: 1 });
TreasureHuntSchema.index({ createdBy: 1, createdAt: -1 });
TreasureHuntSchema.index({ isActive: 1, startDate: 1 });
