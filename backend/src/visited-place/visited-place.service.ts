import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VisitedPlace } from './schemas/visited-place.schema';

@Injectable()
export class VisitedPlaceService {
  constructor(
    @InjectModel(VisitedPlace.name)
    private visitedPlaceModel: Model<VisitedPlace>,
  ) {}

  /**
   * Record that a user visited a place
   */
  async recordVisit(
    userId: string,
    placeCode: string,
    placeType: string,
    visitedAt?: Date,
  ): Promise<VisitedPlace | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid profile ID');
    }
    const normalizedPlaceCode = String(placeCode ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (!normalizedPlaceCode) {
      throw new BadRequestException('placeCode is required');
    }
    if (!['district', 'province'].includes(placeType)) {
      throw new BadRequestException('placeType must be district or province');
    }
    if (visitedAt && Number.isNaN(visitedAt.getTime())) {
      throw new BadRequestException('visitedAt must be a valid date');
    }
    const userIdObj = new Types.ObjectId(userId);

    // Check if already visited
    const existing = await this.visitedPlaceModel.findOne({
      userId: userIdObj,
      placeCode: normalizedPlaceCode,
    });

    if (existing) {
      return null; // Already recorded
    }

    const visitedPlace = new this.visitedPlaceModel({
      userId: userIdObj,
      placeCode: normalizedPlaceCode,
      placeType,
      visitedAt: visitedAt || new Date(),
    });

    return visitedPlace.save();
  }

  async getUserVisits(userId: string): Promise<VisitedPlace[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid profile ID');
    }
    return this.visitedPlaceModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ visitedAt: -1 });
  }

  async removeVisit(userId: string, placeCode: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid profile ID');
    }
    const normalizedPlaceCode = decodeURIComponent(placeCode)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const result = await this.visitedPlaceModel.deleteOne({
      userId: new Types.ObjectId(userId),
      placeCode: normalizedPlaceCode,
    });
    return { removed: result.deletedCount > 0 };
  }

  /**
   * Get all districts visited by a user
   */
  async getDistrictsVisited(userId: string): Promise<VisitedPlace[]> {
    return this.visitedPlaceModel.find({
      userId: new Types.ObjectId(userId),
      placeType: 'district',
    });
  }

  /**
   * Get all provinces visited by a user
   */
  async getProvincesVisited(userId: string): Promise<VisitedPlace[]> {
    return this.visitedPlaceModel.find({
      userId: new Types.ObjectId(userId),
      placeType: 'province',
    });
  }

  /**
   * Get count of districts visited
   */
  async getDistrictCount(userId: string): Promise<number> {
    return this.visitedPlaceModel.countDocuments({
      userId: new Types.ObjectId(userId),
      placeType: 'district',
    });
  }

  /**
   * Get count of provinces visited
   */
  async getProvinceCount(userId: string): Promise<number> {
    return this.visitedPlaceModel.countDocuments({
      userId: new Types.ObjectId(userId),
      placeType: 'province',
    });
  }

  /**
   * Check if user has visited a place
   */
  async hasVisited(userId: string, placeCode: string): Promise<boolean> {
    const record = await this.visitedPlaceModel.findOne({
      userId: new Types.ObjectId(userId),
      placeCode,
    });

    return !!record;
  }
}
