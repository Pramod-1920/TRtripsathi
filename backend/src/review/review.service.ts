import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review } from './schemas/review.schema';
import { CreateReviewDto, UpdateReviewDto, ReviewStatsDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name)
    private reviewModel: Model<Review>,
  ) {}

  /**
   * Create a new review
   * Validates that reviewer and reviewee were on the same trip
   */
  async createReview(
    tripId: string,
    reviewerId: string,
    revieweeId: string,
    createDto: CreateReviewDto,
  ): Promise<Review> {
    // Validate reviewer is not reviewing themselves
    if (reviewerId === revieweeId) {
      throw new BadRequestException('Cannot review yourself');
    }

    // Check if review already exists
    const existingReview = await this.reviewModel.findOne({
      reviewerId: new Types.ObjectId(reviewerId),
      revieweeId: new Types.ObjectId(revieweeId),
      tripId: new Types.ObjectId(tripId),
    });

    if (existingReview) {
      throw new BadRequestException('Review already exists for this trip');
    }

    const review = new this.reviewModel({
      reviewerId: new Types.ObjectId(reviewerId),
      revieweeId: new Types.ObjectId(revieweeId),
      tripId: new Types.ObjectId(tripId),
      rating: createDto.rating,
      comment: createDto.comment,
    });

    return review.save();
  }

  /**
   * Get all reviews for a user
   */
  async getReviewsForUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Review[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.reviewModel.countDocuments({
      revieweeId: userIdObj,
    });

    const data = await this.reviewModel
      .find({ revieweeId: userIdObj })
      .populate('reviewerId', 'firstName lastName avatarUploadId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get review statistics for a user
   * Computes average rating and distribution
   */
  async getReviewStats(userId: string): Promise<ReviewStatsDto> {
    const userIdObj = new Types.ObjectId(userId);

    const reviews = await this.reviewModel.find({
      revieweeId: userIdObj,
    });

    if (reviews.length === 0) {
      return {
        userId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0,
        },
      };
    }

    const distribution = {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
    };

    let totalRating = 0;

    reviews.forEach((review) => {
      totalRating += review.rating;
      if (review.rating === 5) distribution.fiveStar++;
      else if (review.rating === 4) distribution.fourStar++;
      else if (review.rating === 3) distribution.threeStar++;
      else if (review.rating === 2) distribution.twoStar++;
      else if (review.rating === 1) distribution.oneStar++;
    });

    return {
      userId,
      averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution: distribution,
    };
  }

  /**
   * Update a review
   * Only reviewer can update their own review
   */
  async updateReview(
    reviewId: string,
    reviewerId: string,
    updateDto: UpdateReviewDto,
    isAdmin = false,
  ): Promise<Review> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // allow admin to update any review
    if (!isAdmin && review.reviewerId.toString() !== reviewerId) {
      throw new BadRequestException('Can only update your own review');
    }

    if (updateDto.rating !== undefined) {
      review.rating = updateDto.rating;
    }
    if (updateDto.comment !== undefined) {
      review.comment = updateDto.comment;
    }

    review.updatedAt = new Date();
    return review.save();
  }

  /**
   * Delete a review
   * Only reviewer or admin can delete
   */
  async deleteReview(reviewId: string, userId: string, isAdmin = false): Promise<void> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // allow admin to delete any review
    if (!isAdmin && review.reviewerId.toString() !== userId) {
      throw new BadRequestException('Can only delete your own review');
    }

    await this.reviewModel.findByIdAndDelete(reviewId);
  }

  /**
   * Get reviews given by a user (for transparency)
   */
  async getReviewsGivenByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Review[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.reviewModel.countDocuments({
      reviewerId: userIdObj,
    });

    const data = await this.reviewModel
      .find({ reviewerId: userIdObj })
      .populate('revieweeId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get reviews for a specific trip
   * Admin can use this to monitor trip reviews
   */
  async getReviewsForTrip(tripId: string): Promise<Review[]> {
    return this.reviewModel
      .find({ tripId: new Types.ObjectId(tripId) })
      .populate('reviewerId', 'firstName lastName')
      .populate('revieweeId', 'firstName lastName')
      .sort({ createdAt: -1 });
  }

  /**
   * Get all reviews (admin only)
   */
  async getAllReviews(
    page = 1,
    limit = 20,
    options?: {
      sort?: string;
      reviewerId?: string | undefined;
      revieweeId?: string | undefined;
      tripId?: string | undefined;
    },
  ): Promise<{ data: Review[]; total: number }> {
    const filter: Record<string, unknown> = {};

    if (options && options.reviewerId) {
      try {
        filter.reviewerId = new Types.ObjectId(options.reviewerId);
      } catch {
        // invalid id: leave filter out
      }
    }

    if (options && options.revieweeId) {
      try {
        filter.revieweeId = new Types.ObjectId(options.revieweeId);
      } catch {
        // invalid id: ignore
      }
    }

    if (options && options.tripId) {
      try {
        filter.tripId = new Types.ObjectId(options.tripId);
      } catch {
        // invalid id: ignore
      }
    }

    // parse sort option like 'rating:asc' or 'createdAt:desc'
    const defaultSort = { createdAt: -1 } as Record<string, number>;
    let sortObj: Record<string, number> = defaultSort;
    if (options && options.sort) {
      const parts = options.sort.split(':');
      const field = parts[0];
      const dir = parts[1] === 'asc' ? 1 : -1;
      if (field) sortObj = { [field]: dir };
    }

    const total = await this.reviewModel.countDocuments(filter as any);

    const data = await this.reviewModel
      .find(filter as any)
      .populate('reviewerId', 'firstName lastName')
      .populate('revieweeId', 'firstName lastName')
      .populate('tripId', 'title tripCode')
      .sort(sortObj as any)
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Check if a review exists for a trip between two users
   */
  async reviewExists(
    reviewerId: string,
    revieweeId: string,
    tripId: string,
  ): Promise<boolean> {
    const review = await this.reviewModel.findOne({
      reviewerId: new Types.ObjectId(reviewerId),
      revieweeId: new Types.ObjectId(revieweeId),
      tripId: new Types.ObjectId(tripId),
    });

    return !!review;
  }
}
