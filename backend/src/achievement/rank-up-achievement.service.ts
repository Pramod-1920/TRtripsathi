import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RankUpAchievement } from './schemas/rank-up-achievement.schema';
import { UserRankUpAchievement } from './schemas/user-rank-up-achievement.schema';
import {
  CreateRankUpAchievementDto,
  UpdateRankUpAchievementDto,
  RankUpAchievementResponseDto,
  UserRankUpAchievementResponseDto,
  RankUpValidationResponseDto,
  RankCode,
  ActivityType,
  ConditionType,
  ConditionOperator,
} from './dto/rank-up-achievement.dto';

@Injectable()
export class RankUpAchievementService {
  private logger = new Logger(RankUpAchievementService.name);

  constructor(
    @InjectModel(RankUpAchievement.name)
    private rankUpAchievementModel: Model<RankUpAchievement>,
    @InjectModel(UserRankUpAchievement.name)
    private userRankUpAchievementModel: Model<UserRankUpAchievement>,
  ) {}

  /**
   * Create a new rank-up achievement
   */
  async create(
    createDto: CreateRankUpAchievementDto,
    adminId: Types.ObjectId,
  ): Promise<RankUpAchievementResponseDto> {
    const existingAchievement = await this.rankUpAchievementModel.findOne({
      code: createDto.code,
    });
    if (existingAchievement) {
      throw new BadRequestException(
        `Achievement with code '${createDto.code}' already exists`,
      );
    }

    const achievement = new this.rankUpAchievementModel({
      ...createDto,
      createdBy: adminId,
    });

    const saved = await achievement.save();
    this.logger.log(
      `Created rank-up achievement: ${saved.code} for rank ${saved.targetRank}`,
    );
    return this.mapToResponseDto(saved);
  }

  /**
   * Get all rank-up achievements
   */
  async findAll(filters?: {
    targetRank?: RankCode;
    activityType?: string;
    isActive?: boolean;
  }): Promise<RankUpAchievementResponseDto[]> {
    const query: any = {};

    if (filters?.targetRank) {
      query.targetRank = filters.targetRank;
    }
    if (filters?.activityType) {
      query.activityTypes = filters.activityType;
    }
    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const achievements = await this.rankUpAchievementModel
      .find(query)
      .sort({ targetRank: 1 });
    return achievements.map((a) => this.mapToResponseDto(a));
  }

  /**
   * Get rank-up achievements for a specific rank
   */
  async findByRank(
    targetRank: RankCode,
  ): Promise<RankUpAchievementResponseDto[]> {
    const achievements = await this.rankUpAchievementModel
      .find({ targetRank, isActive: true })
      .sort({ createdAt: 1 });

    return achievements.map((a) => this.mapToResponseDto(a));
  }

  /**
   * Get rank-up achievements by activity type
   */
  async findByActivityType(
    activityType: string,
  ): Promise<RankUpAchievementResponseDto[]> {
    const achievements = await this.rankUpAchievementModel
      .find({ activityTypes: activityType, isActive: true })
      .sort({ targetRank: 1 });

    return achievements.map((a) => this.mapToResponseDto(a));
  }

  /**
   * Get a specific rank-up achievement by ID
   */
  async findById(id: string): Promise<RankUpAchievementResponseDto> {
    const achievement = await this.rankUpAchievementModel.findById(id);
    if (!achievement) {
      throw new NotFoundException(
        `Rank-up achievement with ID '${id}' not found`,
      );
    }
    return this.mapToResponseDto(achievement);
  }

  /**
   * Get a specific rank-up achievement by code
   */
  async findByCode(code: string): Promise<RankUpAchievementResponseDto> {
    const achievement = await this.rankUpAchievementModel.findOne({ code });
    if (!achievement) {
      throw new NotFoundException(
        `Rank-up achievement with code '${code}' not found`,
      );
    }
    return this.mapToResponseDto(achievement);
  }

  /**
   * Update a rank-up achievement
   */
  async update(
    id: string,
    updateDto: UpdateRankUpAchievementDto,
  ): Promise<RankUpAchievementResponseDto> {
    const achievement = await this.rankUpAchievementModel.findByIdAndUpdate(
      id,
      updateDto,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!achievement) {
      throw new NotFoundException(
        `Rank-up achievement with ID '${id}' not found`,
      );
    }

    this.logger.log(`Updated rank-up achievement: ${achievement.code}`);
    return this.mapToResponseDto(achievement);
  }

  /**
   * Delete a rank-up achievement
   */
  async delete(id: string): Promise<void> {
    const achievement = await this.rankUpAchievementModel.findByIdAndDelete(id);
    if (!achievement) {
      throw new NotFoundException(
        `Rank-up achievement with ID '${id}' not found`,
      );
    }
    this.logger.log(`Deleted rank-up achievement: ${achievement.code}`);
  }

  /**
   * Get or initialize user rank-up achievement
   */
  async getUserAchievementProgress(
    userId: Types.ObjectId,
    rankUpAchievementId: Types.ObjectId,
  ): Promise<UserRankUpAchievement> {
    let userAchievement = await this.userRankUpAchievementModel.findOne({
      userId,
      rankUpAchievementId,
    });

    if (!userAchievement) {
      userAchievement = new this.userRankUpAchievementModel({
        userId,
        rankUpAchievementId,
        progress: 0,
        isCompleted: false,
      });
      await userAchievement.save();
    }

    return userAchievement;
  }

  /**
   * Update user achievement progress
   */
  async updateProgress(
    userId: Types.ObjectId,
    rankUpAchievementId: Types.ObjectId,
    newProgress: number,
  ): Promise<UserRankUpAchievement> {
    const achievement =
      await this.rankUpAchievementModel.findById(rankUpAchievementId);
    if (!achievement) {
      throw new NotFoundException('Rank-up achievement not found');
    }

    const userAchievement = await this.getUserAchievementProgress(
      userId,
      rankUpAchievementId,
    );
    const wasCompleted = userAchievement.isCompleted;

    userAchievement.progress = newProgress;

    // Check if achievement is now completed
    const isNowCompleted = this.checkCondition(
      newProgress,
      achievement.conditionValue,
      achievement.conditionOperator,
    );

    if (isNowCompleted && !wasCompleted) {
      userAchievement.isCompleted = true;
      userAchievement.completedAt = new Date();
      userAchievement.timesCompleted += 1;
      userAchievement.lastCompletedAt = new Date();
      this.logger.log(
        `User ${userId} completed achievement ${achievement.code}`,
      );
    }

    return userAchievement.save();
  }

  /**
   * Check if user meets rank-up requirements
   */
  async validateRankUp(
    userId: Types.ObjectId,
    targetRank: RankCode,
  ): Promise<RankUpValidationResponseDto> {
    const achievements = await this.rankUpAchievementModel.find({
      targetRank,
      isActive: true,
    });

    if (achievements.length === 0) {
      return {
        targetRank,
        isEligible: true,
        completedAchievements: 0,
        totalRequiredAchievements: 0,
        achievementStatus: [],
        reason: 'No achievements required for this rank',
      };
    }

    const userAchievements = await this.userRankUpAchievementModel
      .find({
        userId,
        rankUpAchievementId: { $in: achievements.map((a) => a._id) },
      })
      .populate('rankUpAchievementId');

    const achievementStatus = achievements.map((achievement) => {
      const userAch = userAchievements.find((ua) =>
        ua.rankUpAchievementId._id.equals(achievement._id),
      );

      return {
        code: achievement.code,
        name: achievement.name,
        isCompleted: userAch?.isCompleted || false,
        progress: userAch?.progress || 0,
        required: achievement.conditionValue,
      };
    });

    const completedCount = achievementStatus.filter(
      (a) => a.isCompleted,
    ).length;
    const isEligible = completedCount === achievements.length;

    return {
      targetRank,
      isEligible,
      completedAchievements: completedCount,
      totalRequiredAchievements: achievements.length,
      achievementStatus,
      reason: isEligible
        ? 'All achievements completed'
        : 'Some achievements still pending',
    };
  }

  /**
   * Get all rank-up progress for a user
   */
  async getUserRankUpProgress(
    userId: Types.ObjectId,
  ): Promise<RankUpValidationResponseDto[]> {
    const ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    const progressByRank = await Promise.all(
      ranks.map((rank) => this.validateRankUp(userId, rank as RankCode)),
    );

    return progressByRank;
  }

  /**
   * Helper: Check if progress meets condition
   */
  private checkCondition(
    progress: number,
    conditionValue: number,
    operator: string,
  ): boolean {
    switch (operator) {
      case 'gte':
        return progress >= conditionValue;
      case 'gt':
        return progress > conditionValue;
      case 'lte':
        return progress <= conditionValue;
      case 'lt':
        return progress < conditionValue;
      case 'eq':
        return progress === conditionValue;
      default:
        return false;
    }
  }

  /**
   * Map document to response DTO
   */
  private mapToResponseDto(
    achievement: RankUpAchievement,
  ): RankUpAchievementResponseDto {
    return {
      id: achievement._id.toString(),
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      targetRank: achievement.targetRank as RankCode,
      activityTypes: achievement.activityTypes as ActivityType[],
      conditionType: achievement.conditionType as ConditionType,
      conditionField: achievement.conditionField,
      conditionOperator: achievement.conditionOperator as ConditionOperator,
      conditionValue: achievement.conditionValue,
      filterField: achievement.filterField,
      filterValue: achievement.filterValue,
      minLevel: achievement.minLevel,
      minXp: achievement.minXp,
      xpReward: achievement.xpReward,
      badgeCode: achievement.badgeCode,
      isActive: achievement.isActive,
      isRepeatable: achievement.isRepeatable,
      maxCompletions: achievement.maxCompletions,
      createdAt: achievement.createdAt,
      updatedAt: achievement.updatedAt,
    };
  }
}
