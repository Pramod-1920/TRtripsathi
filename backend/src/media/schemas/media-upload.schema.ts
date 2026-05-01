import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class MediaUpload extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploaderId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ['avatar', 'trip_photo', 'past_experience', 'badge_icon'],
  })
  purpose: string;

  @Prop({ type: Types.ObjectId, ref: 'Trip', nullable: true })
  tripId: Types.ObjectId; // For trip photos

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'flagged_ai'],
  })
  status: string; // pending = awaiting review, approved = live, rejected = moderation fail, flagged_ai = AI flagged

  // Cloudinary Data
  @Prop({ type: String, required: true })
  cloudinaryPublicId: string;

  @Prop({ type: String, required: true })
  cloudinaryUrl: string;

  @Prop({ type: String, required: true })
  cloudinaryThumbnailUrl: string; // Optimized 300x300 thumbnail

  // Moderation
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  aiScore: number; // AI moderation score (0-100), higher = more likely inappropriate

  @Prop({ type: String, maxlength: 500 })
  rejectionReason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', nullable: true })
  reviewedBy: Types.ObjectId; // Admin who reviewed

  @Prop({ type: Date })
  reviewedAt: Date;

  // Metadata
  @Prop({ type: Object })
  metadata: Record<string, any>; // width, height, size, mimeType, etc.

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  approvedAt: Date;
}

export const MediaUploadSchema = SchemaFactory.createForClass(MediaUpload);

// Indexes
MediaUploadSchema.index({ uploaderId: 1, createdAt: -1 });
MediaUploadSchema.index({ tripId: 1, status: 1 });
MediaUploadSchema.index({ status: 1, createdAt: -1 });
MediaUploadSchema.index({ purpose: 1, status: 1 });
