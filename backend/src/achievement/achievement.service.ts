import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AchievementDefinition } from './schemas/achievement-definition.schema';
import { UserAchievement } from './schemas/user-achievement.schema';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
  UserAchievementProgressDto,
  UserAchievementsResponseDto,
} from './dto/achievement.dto';

@Injectable()
export class AchievementService {
  constructor(
    @InjectModel(AchievementDefinition.name)
    private achievementDefModel: Model<AchievementDefinition>,
    @InjectModel(UserAchievement.name)
    private userAchievementModel: Model<UserAchievement>,
  ) {}

  // ──────────────────────────────
  // ADMIN: ACHIEVEMENT MANAGEMENT
  // ──────────────────────────────

  /**
   * Create a new achievement definition
   */
  async createAchievement(
    createDto: CreateAchievementDto,
    adminId: Types.ObjectId,
  ): Promise<AchievementDefinition> {
    const achievement = new this.achievementDefModel({
      ...createDto,
      createdBy: adminId,
      conditionOperator: createDto.conditionOperator || 'gte',
      xpReward: createDto.xpReward || 0,
    });

    return achievement.save();
  }

  /**
   * Update an achievement definition
   */
  async updateAchievement(
    achievementId: string,
    updateDto: UpdateAchievementDto,
  ): Promise<AchievementDefinition | null> {
    return this.achievementDefModel.findByIdAndUpdate(
      achievementId,
      updateDto,
      { new: true },
    );
  }

  /**
   * List all achievements with filters
   */
  async listAchievements(
    category?: string,
    isActive?: boolean,
    page = 1,
    limit = 20,
  ): Promise<{ data: AchievementDefinition[]; total: number }> {
    const query: any = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive;

    const total = await this.achievementDefModel.countDocuments(query);
    const data = await this.achievementDefModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return { data, total };
  }

  /**
   * Get a single achievement definition
   */
  async getAchievementById(
    achievementId: string,
  ): Promise<AchievementDefinition | null> {
    return this.achievementDefModel.findById(achievementId);
  }

  /**
   * Delete an achievement definition
   */
  async deleteAchievement(achievementId: string): Promise<void> {
    await this.achievementDefModel.findByIdAndDelete(achievementId);
    // Optionally: also delete all user progress for this achievement
    await this.userAchievementModel.deleteMany({
      achievementId: new Types.ObjectId(achievementId),
    });
  }

  // ──────────────────────────────
  // USER: ACHIEVEMENT PROGRESS
  // ──────────────────────────────

  /**
   * Get all achievements for a user with progress
   */
  async getUserAchievements(
    userId: string,
  ): Promise<UserAchievementsResponseDto> {
    const userIdObj = new Types.ObjectId(userId);

    // Get all active achievement definitions
    const achievements = await this.achievementDefModel.find({
      isActive: true,
    });

    // Get user's progress for all achievements
    const userProgress = await this.userAchievementModel.find({
      userId: userIdObj,
    });

    // Create a map for quick lookup
    const progressMap = new Map();
    userProgress.forEach((ua) => {
      progressMap.set(ua.achievementId.toString(), ua);
    });

    // Build response with progress for each achievement
    const achievementList: UserAchievementProgressDto[] = achievements.map(
      (ach) => {
        const progress = progressMap.get(ach._id.toString());

        const progressValue = progress?.progress || 0;
        const progressPercentage =
          ach.conditionValue > 0
            ? Math.min(
                Math.floor((progressValue / ach.conditionValue) * 100),
                100,
              )
            : 0;

        return {
          achievementId: ach._id.toString(),
          code: ach.code,
          name: ach.name,
          category: ach.category,
          progress: progressValue,
          conditionValue: ach.conditionValue,
          isCompleted: progress?.isCompleted || false,
          completedAt: progress?.completedAt,
          timesCompleted: progress?.timesCompleted || 0,
          xpReward: ach.xpReward,
          badgeCode: ach.badgeCode,
          progressPercentage,
        };
      },
    );

    const completedCount = achievementList.filter(
      (a) => a.isCompleted,
    ).length;
    const completionPercentage =
      achievements.length > 0
        ? Math.floor((completedCount / achievements.length) * 100)
        : 0;

    return {
      userId,
      totalAchievements: achievements.length,
      completedAchievements: completedCount,
      completionPercentage,
      achievements: achievementList,
    };
  }

  /**
   * Get a specific user achievement progress
   */
  async getUserAchievementProgress(
    userId: string,
    achievementId: string,
  ): Promise<UserAchievement | null> {
    return this.userAchievementModel.findOne({
      userId: new Types.ObjectId(userId),
      achievementId: new Types.ObjectId(achievementId),
    });
  }

  /**
   * Initialize achievements for a new user (called on signup)
   */
  async initializeUserAchievements(userId: string): Promise<void> {
    const userIdObj = new Types.ObjectId(userId);

    // Get all active achievement definitions
    const achievements = await this.achievementDefModel.find({
      isActive: true,
    });

    // Create user achievement records
    const userAchievements = achievements.map((ach) => ({
      userId: userIdObj,
      achievementId: ach._id,
      progress: 0,
      isCompleted: false,
      timesCompleted: 0,
    }));

    if (userAchievements.length > 0) {
      await this.userAchievementModel.insertMany(userAchievements);
    }
  }

  /**
   * Check and update achievements for a user based on their current stats
   * Called after significant user actions (campaign completion, level up, etc.)
   */
  async checkAndUpdateAchievements(
    userId: string,
    userStats: any, // User's current stats from User collection
  ): Promise<{ unlockedAchievements: string[]; xpAwarded: number }> {
    const userIdObj = new Types.ObjectId(userId);
    const unlockedAchievements: string[] = [];
    let totalXpAwarded = 0;

    // Get all user's achievement progress
    const userAchievements = await this.userAchievementModel.find({
      userId: userIdObj,
    });

    // Get achievement definitions
    const achievementDefs = new Map();
    (
      await this.achievementDefModel.find({ isActive: true })
    ).forEach((a) => {
      achievementDefs.set(a._id.toString(), a);
    });

    // Check each achievement
    for (const ua of userAchievements) {
      const achDef = achievementDefs.get(ua.achievementId.toString());
      if (!achDef) continue;

      // Get the value from user stats (e.g., userStats.xp, userStats.level, etc.)
      let currentValue = userStats[achDef.conditionField];

      // Handle nested fields (e.g., 'activityCounts.adventure')
      if (achDef.conditionField.includes('.')) {
        const parts = achDef.conditionField.split('.');
        currentValue = userStats[parts[0]]?.[parts[1]];
      }

      // Apply filter if specified (e.g., only count specific activity types)
      if (achDef.filterField && achDef.filterValue) {
        // This would require more complex logic depending on data structure
        // For now, we track the raw value
      }

      if (currentValue === undefined || currentValue === null) {
        currentValue = 0;
      }

      // Update progress
      const wasCompleted = ua.isCompleted;
      const meetsCondition = this.checkCondition(
        currentValue,
        achDef.conditionValue,
        achDef.conditionOperator || 'gte',
      );

      ua.progress = currentValue;

      // Check if newly unlocked
      if (meetsCondition && !wasCompleted) {
        ua.isCompleted = true;
        ua.completedAt = new Date();
        ua.timesCompleted += 1;
        ua.lastCompletedAt = new Date();

        unlockedAchievements.push(achDef.code);
        totalXpAwarded += achDef.xpReward;
      }
      // Check if it's repeatable and can be re-unlocked
      else if (
        meetsCondition &&
        wasCompleted &&
        achDef.isRepeatable &&
        (!achDef.maxCompletions || ua.timesCompleted < achDef.maxCompletions)
      ) {
        // Reset for re-unlock detection (depends on game design)
        ua.timesCompleted += 1;
        ua.lastCompletedAt = new Date();

        unlockedAchievements.push(`${achDef.code}_repeat_${ua.timesCompleted}`);
        totalXpAwarded += achDef.xpReward;
      }

      await ua.save();
    }

    return { unlockedAchievements, xpAwarded: totalXpAwarded };
  }

  /**
   * Helper: Check if a value meets a condition
   */
  private checkCondition(
    value: number,
    target: number,
    operator: string,
  ): boolean {
    switch (operator) {
      case 'gte':
        return value >= target;
      case 'gt':
        return value > target;
      case 'lte':
        return value <= target;
      case 'lt':
        return value < target;
      case 'eq':
        return value === target;
      default:
        return false;
    }
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(
    category: string,
  ): Promise<AchievementDefinition[]> {
    return this.achievementDefModel.find({
      category,
      isActive: true,
    });
  }

  /**
   * Manually reset a user's achievement progress (admin only)
   */
  async resetUserAchievement(
    userId: string,
    achievementId: string,
  ): Promise<UserAchievement | null> {
    const userIdObj = new Types.ObjectId(userId);
    const achIdObj = new Types.ObjectId(achievementId);

    return this.userAchievementModel.findOneAndUpdate(
      { userId: userIdObj, achievementId: achIdObj },
      {
        progress: 0,
        isCompleted: false,
        completedAt: null,
        timesCompleted: 0,
        lastCompletedAt: null,
      },
      { new: true },
    );
  }
}
