import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: [
      'trip_joined',
      'trip_approved',
      'trip_rejected',
      'trip_started',
      'trip_completed',
      'review_received',
      'message_received',
      'achievement_unlocked',
      'xp_awarded',
      'level_up',
      'admin_message',
      'safety_alert',
      'report_status_changed',
    ],
  })
  type: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Object })
  data: Record<string, any>; // Additional data (tripId, achievementId, etc.)

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  expiresAt: Date; // TTL 30 days
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes for efficient querying
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
