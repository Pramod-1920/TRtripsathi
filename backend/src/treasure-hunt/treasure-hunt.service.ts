import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TreasureHunt } from './schemas/treasure-hunt.schema';
import { TreasureProgress } from './schemas/treasure-progress.schema';

@Injectable()
export class TreasureHuntService {
  constructor(
    @InjectModel(TreasureHunt.name)
    private treasureHuntModel: Model<TreasureHunt>,
    @InjectModel(TreasureProgress.name)
    private treasureProgressModel: Model<TreasureProgress>,
  ) {}

  /**
   * Create a treasure hunt
   */
  async createTreasureHunt(
    userId: string,
    name: string,
    waypoints: any[],
    difficulty: string,
    startDate: Date,
    endDate: Date,
    description?: string,
    tripId?: string,
    estimatedDurationMinutes?: number,
    xpReward?: number,
  ): Promise<TreasureHunt> {
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (waypoints.length === 0) {
      throw new BadRequestException('At least one waypoint is required');
    }

    const hunt = new this.treasureHuntModel({
      name,
      description,
      createdBy: new Types.ObjectId(userId),
      tripId: tripId ? new Types.ObjectId(tripId) : null,
      waypoints: waypoints.map((w, idx) => ({
        order: idx + 1,
        clue: w.clue,
        location: {
          type: 'Point',
          coordinates: [w.location.coordinates[0], w.location.coordinates[1]], // [lon, lat]
        },
        radius: w.radius,
        hint: w.hint,
      })),
      difficulty,
      estimatedDurationMinutes: estimatedDurationMinutes || 60,
      xpReward: xpReward || 0,
      startDate,
      endDate,
    });

    return hunt.save();
  }

  /**
   * Get all active treasure hunts
   */
  async getActiveTreasureHunts(
    page = 1,
    limit = 20,
  ): Promise<{ data: TreasureHunt[]; total: number }> {
    const now = new Date();

    const total = await this.treasureHuntModel.countDocuments({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    const data = await this.treasureHuntModel
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .populate('createdBy', 'name profilePhoto')
      .sort({ startDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get treasure hunt by ID
   */
  async getTreasureHunt(huntId: string): Promise<TreasureHunt> {
    const hunt = await this.treasureHuntModel
      .findById(huntId)
      .populate('createdBy', 'name profilePhoto');

    if (!hunt) {
      throw new NotFoundException('Treasure hunt not found');
    }

    return hunt;
  }

  /**
   * Get treasure hunts for a trip
   */
  async getTreasureHuntsByTrip(tripId: string): Promise<TreasureHunt[]> {
    return this.treasureHuntModel
      .find({
        tripId: new Types.ObjectId(tripId),
        isActive: true,
      })
      .populate('createdBy', 'name profilePhoto')
      .sort({ startDate: -1 });
  }

  /**
   * Update treasure hunt
   */
  async updateTreasureHunt(
    huntId: string,
    updates: any,
    userId: string,
  ): Promise<TreasureHunt> {
    const hunt = await this.treasureHuntModel.findById(huntId);

    if (!hunt) {
      throw new NotFoundException('Treasure hunt not found');
    }

    if (hunt.createdBy.toString() !== userId) {
      throw new BadRequestException('Only creator can update hunt');
    }

    Object.assign(hunt, updates);
    return hunt.save();
  }

  /**
   * Verify user's location against a waypoint
   * Returns true if within radius
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Verify waypoint completion
   */
  async verifyWaypoint(
    huntId: string,
    userId: string,
    waypointOrder: number,
    userLatitude: number,
    userLongitude: number,
  ): Promise<{ success: boolean; message: string; isComplete?: boolean }> {
    const hunt = await this.getTreasureHunt(huntId);
    const waypoint = hunt.waypoints.find((w) => w.order === waypointOrder);

    if (!waypoint) {
      throw new NotFoundException('Waypoint not found');
    }

    // Calculate distance
    const distance = this.calculateDistance(
      userLatitude,
      userLongitude,
      waypoint.location.coordinates[1], // latitude
      waypoint.location.coordinates[0], // longitude
    );

    if (distance > waypoint.radius) {
      return {
        success: false,
        message: `Too far from waypoint. Distance: ${Math.round(distance)}m, Radius: ${waypoint.radius}m`,
      };
    }

    // Get or create progress
    let progress = await this.treasureProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      treasureHuntId: new Types.ObjectId(huntId),
    });

    if (!progress) {
      progress = new this.treasureProgressModel({
        userId: new Types.ObjectId(userId),
        treasureHuntId: new Types.ObjectId(huntId),
      });
    }

    // Check if already completed
    const completed = progress.completedWaypoints.some(
      (w) => w.waypointOrder === waypointOrder,
    );

    if (completed) {
      return {
        success: true,
        message: 'Waypoint already completed',
        isComplete: progress.isWinner,
      };
    }

    // Add waypoint
    progress.completedWaypoints.push({
      waypointOrder,
      completedAt: new Date(),
    });

    // Check if all waypoints completed
    if (progress.completedWaypoints.length === hunt.waypoints.length) {
      progress.isWinner = true;
      progress.completedAt = new Date();
      const startTime = progress.createdAt;
      const endTime = progress.completedAt;
      progress.timeToCompleteMinutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / 60000,
      );
    }

    await progress.save();

    return {
      success: true,
      message: 'Waypoint verified!',
      isComplete: progress.isWinner,
    };
  }

  /**
   * Get user's progress on a hunt
   */
  async getUserProgress(huntId: string, userId: string): Promise<TreasureProgress> {
    let progress = await this.treasureProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      treasureHuntId: new Types.ObjectId(huntId),
    }) as TreasureProgress | null;

    if (!progress) {
      progress = new this.treasureProgressModel({
        userId: new Types.ObjectId(userId),
        treasureHuntId: new Types.ObjectId(huntId),
      });
    }

    return progress;
  }

  /**
   * Get leaderboard for a treasure hunt
   */
  async getTreasureHuntLeaderboard(huntId: string, limit = 50): Promise<any[]> {
    return this.treasureProgressModel.aggregate([
      {
        $match: {
          treasureHuntId: new Types.ObjectId(huntId),
          isWinner: true,
        },
      },
      {
        $sort: { completedAt: 1 }, // Earliest completion time first
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $project: {
          rank: { $add: 1 },
          user: { $arrayElemAt: ['$user', 0] },
          timeToCompleteMinutes: 1,
          completedAt: 1,
        },
      },
    ]);
  }

  /**
   * Get all user's treasure hunt progress
   */
  async getUserTreasureProgress(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: TreasureProgress[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.treasureProgressModel.countDocuments({
      userId: userIdObj,
    });

    const data = await this.treasureProgressModel
      .find({ userId: userIdObj })
      .populate('treasureHuntId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Award XP for completing a hunt (called once)
   */
  async markXpAwarded(progressId: string): Promise<TreasureProgress | null> {
    return this.treasureProgressModel.findByIdAndUpdate(
      progressId,
      { xpAwarded: true },
      { new: true },
    );
  }
}
