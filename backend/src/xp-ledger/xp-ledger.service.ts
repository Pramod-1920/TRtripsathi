import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { XpLedger } from './schemas/xp-ledger.schema';

@Injectable()
export class XpLedgerService {
  constructor(
    @InjectModel(XpLedger.name)
    private xpLedgerModel: Model<XpLedger>,
  ) {}

  private isDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      Number((error as { code?: number }).code) === 11000
    );
  }

  /**
   * Reserve a unique XP context before mutating the user's XP balance.
   * A retry receives the existing reservation and can safely finish applying it.
   */
  async reserveXpAward(input: {
    userId: string;
    xpAmount: number;
    eventCode: string;
    contextKey: string;
    description?: string;
    metadata?: Record<string, unknown>;
    awardedBy?: string;
  }): Promise<{ ledger: XpLedger; created: boolean }> {
    const userId = new Types.ObjectId(input.userId);
    try {
      const ledger = await this.xpLedgerModel.create({
        userId,
        xpAmount: input.xpAmount,
        balanceAfter: 0,
        eventCode: input.eventCode,
        contextKey: input.contextKey,
        description: input.description,
        metadata: input.metadata ?? {},
        awardedBy: input.awardedBy ? new Types.ObjectId(input.awardedBy) : null,
      });
      return { ledger, created: true };
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }

      const ledger = await this.xpLedgerModel.findOne({
        userId,
        contextKey: input.contextKey,
      });
      if (!ledger) {
        throw error;
      }
      return { ledger, created: false };
    }
  }

  async markXpAwardApplied(ledgerId: string, balanceAfter: number) {
    return this.xpLedgerModel.findByIdAndUpdate(
      ledgerId,
      {
        $set: {
          balanceAfter,
          appliedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  /**
   * Record an XP award
   */
  async recordXpAward(
    userId: string,
    xpAmount: number,
    balanceAfter: number,
    eventCode: string,
    description?: string,
    metadata?: Record<string, any>,
    awardedBy?: string,
    contextKey?: string,
  ): Promise<XpLedger> {
    const ledger = new this.xpLedgerModel({
      userId: new Types.ObjectId(userId),
      xpAmount,
      balanceAfter,
      eventCode,
      description,
      metadata: metadata || {},
      awardedBy: awardedBy ? new Types.ObjectId(awardedBy) : null,
      ...(contextKey ? { contextKey } : {}),
      appliedAt: new Date(),
    });

    return ledger.save();
  }

  /**
   * Get XP history for a user
   */
  async getUserXpHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: XpLedger[]; total: number }> {
    const userIdObj = new Types.ObjectId(userId);

    const total = await this.xpLedgerModel.countDocuments({
      userId: userIdObj,
    });

    const data = await this.xpLedgerModel
      .find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { data, total };
  }

  /**
   * Get XP awards by event type
   */
  async getXpByEventType(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);

    return this.xpLedgerModel.aggregate([
      { $match: { userId: userIdObj } },
      {
        $group: {
          _id: '$eventCode',
          totalXp: { $sum: '$xpAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalXp: -1 } },
    ]);
  }

  /**
   * Get total XP awarded to a user
   */
  async getTotalXpAwarded(userId: string): Promise<number> {
    const result = await this.xpLedgerModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId), isReversed: false } },
      { $group: { _id: null, total: { $sum: '$xpAmount' } } },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  /**
   * Reverse an XP award
   */
  async reverseXpAward(ledgerId: string): Promise<XpLedger | null> {
    return this.xpLedgerModel.findByIdAndUpdate(
      ledgerId,
      { isReversed: true },
      { new: true },
    );
  }

  /**
   * Get leaderboard by total XP
   */
  async getXpLeaderboard(limit = 100): Promise<any[]> {
    return this.xpLedgerModel.aggregate([
      { $match: { isReversed: false } },
      {
        $group: {
          _id: '$userId',
          totalXp: { $sum: '$xpAmount' },
        },
      },
      { $sort: { totalXp: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
    ]);
  }
}
