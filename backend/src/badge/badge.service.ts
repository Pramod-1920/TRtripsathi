import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserBadge } from './schemas/badge.schema';

@Injectable()
export class BadgeService {
  constructor(
    @InjectModel(UserBadge.name)
    private badgeModel: Model<UserBadge>,
  ) {}

  /**
   * Award a badge to a user
   */
  async awardBadge(
    userId: string,
    badgeCode: string,
    tier: string,
    name: string,
    description: string,
    iconUrl: string,
  ): Promise<UserBadge | null> {
    // Check if already awarded
    const existing = await this.badgeModel.findOne({
      userId: new Types.ObjectId(userId),
      badgeCode,
    });

    if (existing) {
      return null; // Already awarded
    }

    const badge = new this.badgeModel({
      userId: new Types.ObjectId(userId),
      badgeCode,
      tier,
      name,
      description,
      iconUrl,
      unlockedAt: new Date(),
    });

    try {
      return await badge.save();
    } catch (error: unknown) {
      // Concurrent requests can race to award the same badge. The unique
      // database index is the final idempotency guard.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Get all badges for a user
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return this.badgeModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ unlockedAt: -1 });
  }

  /**
   * Get badges by tier
   */
  async getUserBadgesByTier(
    userId: string,
    tier: string,
  ): Promise<UserBadge[]> {
    return this.badgeModel.find({
      userId: new Types.ObjectId(userId),
      tier,
    });
  }

  /**
   * Count badges for a user
   */
  async getBadgeCount(userId: string): Promise<number> {
    return this.badgeModel.countDocuments({
      userId: new Types.ObjectId(userId),
    });
  }

  /**
   * Check if user has a badge
   */
  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    const badge = await this.badgeModel.findOne({
      userId: new Types.ObjectId(userId),
      badgeCode,
    });

    return !!badge;
  }

  /**
   * Get recent badges (for leaderboard/discovery)
   */
  async getRecentBadges(limit = 20): Promise<UserBadge[]> {
    return this.badgeModel
      .find()
      .sort({ unlockedAt: -1 })
      .limit(limit)
      .populate('userId', 'name profilePhoto');
  }

  /**
   * Get badge stats across all users
   */
  async getBadgeStats(): Promise<any> {
    return this.badgeModel.aggregate([
      {
        $group: {
          _id: '$badgeCode',
          count: { $sum: 1 },
          tier: { $first: '$tier' },
          name: { $first: '$name' },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  /**
   * Revoke a badge (admin only)
   */
  async revokeBadge(userId: string, badgeCode: string): Promise<void> {
    await this.badgeModel.deleteOne({
      userId: new Types.ObjectId(userId),
      badgeCode,
    });
  }
}
