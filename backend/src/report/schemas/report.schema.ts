import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId; // ObjectId of user or trip being reported

  @Prop({
    type: String,
    required: true,
    enum: ['user', 'trip'],
  })
  targetType: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'harassment',
      'spam',
      'inappropriate_content',
      'safety_concern',
      'fraud',
      'other',
    ],
  })
  reason: string;

  @Prop({ type: String, required: true, minlength: 20, maxlength: 500 })
  description: string;

  @Prop({
    type: String,
    default: 'open',
    enum: ['open', 'investigating', 'resolved', 'dismissed'],
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo: Types.ObjectId; // Moderator assigned to this report

  @Prop({ type: String })
  resolution: string; // Admin comment/resolution

  @Prop({ type: Date })
  resolvedAt: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Indexes for efficient moderation
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ targetId: 1, targetType: 1 });
ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ assignedTo: 1, status: 1 });
