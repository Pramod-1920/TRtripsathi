import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review } from './schemas/review.schema';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewStatsDto,
} from './dto/review.dto';
import { User } from '../user/schemas/user.schema';
import { Trip } from '../trip/schemas/trip.schema';
import { TripParticipant } from '../trip/schemas/trip-participant.schema';
import { Campaign } from '../campaign/schemas/campaign.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name)
    private reviewModel: Model<Review>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Trip.name)
    private tripModel: Model<Trip>,
    @InjectModel(TripParticipant.name)
    private tripParticipantModel: Model<TripParticipant>,
    @InjectModel(Campaign.name)
    private campaignModel: Model<Campaign>,
  ) {}

  private toObjectId(id: string, field: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  private async resolveUserProfileIdFromAuthId(
    authId: string,
  ): Promise<Types.ObjectId> {
    const authObjectId = this.toObjectId(authId, 'reviewer id');
    const reviewer = await this.userModel
      .findOne({ authId: authObjectId })
      .select('_id')
      .lean();

    if (!reviewer?._id) {
      throw new NotFoundException('Reviewer profile not found');
    }

    return reviewer._id;
  }

  async getUserProfileIdFromAuthId(authId: string): Promise<string> {
    const userProfileId = await this.resolveUserProfileIdFromAuthId(authId);
    return userProfileId.toString();
  }

  private async ensureTripReviewEligibility(
    tripObjectId: Types.ObjectId,
    reviewerProfileId: Types.ObjectId,
    revieweeProfileId: Types.ObjectId,
  ): Promise<boolean> {
    const trip = await this.tripModel.findById(tripObjectId).lean();
    if (!trip || trip.isDeleted || trip.status !== 'completed') {
      return false;
    }

    const participants = await this.tripParticipantModel
      .find({
        tripId: tripObjectId,
        userId: { $in: [reviewerProfileId, revieweeProfileId] },
        status: 'approved',
        completionConfirmed: true,
      })
      .select('userId')
      .lean();

    return participants.length === 2;
  }

  private async ensureCampaignReviewEligibility(
    campaignObjectId: Types.ObjectId,
    reviewerProfileId: Types.ObjectId,
    revieweeProfileId: Types.ObjectId,
  ): Promise<boolean> {
    const campaign = await this.campaignModel.findById(campaignObjectId).lean();
    if (
      !campaign ||
      campaign.deletedByAdmin ||
      campaign.lifecyclePhase !== 'completed'
    ) {
      return false;
    }

    const participants = campaign.participants ?? [];
    const reviewerParticipant = participants.find(
      (participant: any) =>
        participant.userId?.toString() === reviewerProfileId.toString(),
    );
    const revieweeParticipant = participants.find(
      (participant: any) =>
        participant.userId?.toString() === revieweeProfileId.toString(),
    );

    const isEligible = (participant: any) =>
      participant &&
      participant.status === 'accepted' &&
      participant.leftAt == null;

    return isEligible(reviewerParticipant) && isEligible(revieweeParticipant);
  }

  /**
   * Create a new review
   * Validates that reviewer and reviewee were on the same trip
   */
  async createReview(
    tripId: string,
    reviewerAuthId: string,
    revieweeId: string,
    createDto: CreateReviewDto,
  ): Promise<Review> {
    const tripObjectId = this.toObjectId(tripId, 'trip id');
    const revieweeProfileId = this.toObjectId(revieweeId, 'reviewee id');
    const reviewerProfileId =
      await this.resolveUserProfileIdFromAuthId(reviewerAuthId);

    // Validate reviewer is not reviewing themselves (profile identity)
    if (reviewerProfileId.toString() === revieweeProfileId.toString()) {
      throw new BadRequestException('Cannot review yourself');
    }

    const [tripEligible, campaignEligible] = await Promise.all([
      this.ensureTripReviewEligibility(
        tripObjectId,
        reviewerProfileId,
        revieweeProfileId,
      ),
      this.ensureCampaignReviewEligibility(
        tripObjectId,
        reviewerProfileId,
        revieweeProfileId,
      ),
    ]);

    if (!tripEligible && !campaignEligible) {
      throw new BadRequestException(
        'Reviews are allowed only for completed trips/campaigns where both participants were accepted and remained active until completion',
      );
    }

    // Check if review already exists
    const existingReview = await this.reviewModel.findOne({
      reviewerId: reviewerProfileId,
      revieweeId: revieweeProfileId,
      tripId: tripObjectId,
    });

    if (existingReview) {
      throw new BadRequestException('Review already exists for this trip');
    }

    const review = new this.reviewModel({
      reviewerId: reviewerProfileId,
      revieweeId: revieweeProfileId,
      tripId: tripObjectId,
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
    reviewerAuthId: string,
    updateDto: UpdateReviewDto,
    isAdmin = false,
  ): Promise<Review> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // allow admin to update any review
    const reviewerProfileId = isAdmin
      ? null
      : await this.resolveUserProfileIdFromAuthId(reviewerAuthId);

    if (
      !isAdmin &&
      review.reviewerId.toString() !== reviewerProfileId?.toString()
    ) {
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
  async deleteReview(
    reviewId: string,
    reviewerAuthId: string,
    isAdmin = false,
  ): Promise<void> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // allow admin to delete any review
    const reviewerProfileId = isAdmin
      ? null
      : await this.resolveUserProfileIdFromAuthId(reviewerAuthId);

    if (
      !isAdmin &&
      review.reviewerId.toString() !== reviewerProfileId?.toString()
    ) {
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
