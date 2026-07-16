import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MediaUpload } from './schemas/media-upload.schema';

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(MediaUpload.name)
    private mediaModel: Model<MediaUpload>,
  ) {}

  /**
   * Record a media upload (after Cloudinary upload)
   */
  async recordUpload(
    uploaderId: string,
    purpose: string,
    cloudinaryPublicId: string,
    cloudinaryUrl: string,
    cloudinaryThumbnailUrl: string,
    tripId?: string,
    metadata?: Record<string, any>,
    aiScore?: number,
  ): Promise<MediaUpload> {
    const media = new this.mediaModel({
      uploaderId: new Types.ObjectId(uploaderId),
      purpose,
      tripId: tripId ? new Types.ObjectId(tripId) : null,
      cloudinaryPublicId,
      cloudinaryUrl,
      cloudinaryThumbnailUrl,
      metadata: metadata || {},
      status: aiScore && aiScore > 50 ? 'flagged_ai' : 'pending',
      aiScore: aiScore || 0,
    });

    return media.save();
  }

  /**
   * Get pending media for moderation
   */
  async getPendingMedia(
    page = 1,
    limit = 20,
  ): Promise<{ data: MediaUpload[]; total: number }> {
    const total = await this.mediaModel.countDocuments({
      $or: [{ status: 'pending' }, { status: 'flagged_ai' }],
    });

    const data = await this.mediaModel
      .find({
        $or: [{ status: 'pending' }, { status: 'flagged_ai' }],
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('uploaderId', 'name email');

    return { data, total };
  }

  /**
   * Approve media
   */
  async approveMedia(
    mediaId: string,
    reviewedBy: string,
  ): Promise<MediaUpload | null> {
    return this.mediaModel.findByIdAndUpdate(
      mediaId,
      {
        status: 'approved',
        reviewedBy: new Types.ObjectId(reviewedBy),
        reviewedAt: new Date(),
        approvedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Reject media
   */
  async rejectMedia(
    mediaId: string,
    reason: string,
    reviewedBy: string,
  ): Promise<MediaUpload | null> {
    return this.mediaModel.findByIdAndUpdate(
      mediaId,
      {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: new Types.ObjectId(reviewedBy),
        reviewedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Get user's media
   */
  async getUserMedia(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: MediaUpload[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.mediaModel.countDocuments({
      uploaderId: userIdObj,
      status: 'approved',
    });

    const data = await this.mediaModel
      .find({
        uploaderId: userIdObj,
        status: 'approved',
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get trip media
   */
  async getTripMedia(tripId: string): Promise<MediaUpload[]> {
    return this.mediaModel
      .find({
        tripId: new Types.ObjectId(tripId),
        status: 'approved',
      })
      .sort({ createdAt: -1 });
  }

  /**
   * Get user's avatar
   */
  async getUserAvatar(userId: string): Promise<MediaUpload | null> {
    return this.mediaModel.findOne({
      uploaderId: new Types.ObjectId(userId),
      purpose: 'avatar',
      status: 'approved',
    });
  }

  /**
   * Get moderation stats
   */
  async getModerationStats(): Promise<any> {
    return this.mediaModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          pending: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'pending'] }, '$count', 0],
            },
          },
          flagged: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'flagged_ai'] }, '$count', 0],
            },
          },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'approved'] }, '$count', 0],
            },
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$_id', 'rejected'] }, '$count', 0],
            },
          },
        },
      },
    ]);
  }
}
