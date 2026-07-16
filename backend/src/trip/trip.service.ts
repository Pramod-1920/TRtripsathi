import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import crypto from 'crypto';
import { Trip } from './schemas/trip.schema';
import { TripParticipant } from './schemas/trip-participant.schema';
import { CreateTripDto, UpdateTripDto, JoinTripDto, CheckinTripDto, ApproveParticipantDto, ConfirmCompletionDto } from './dto/create-trip.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TripService {
  constructor(
    @InjectModel(Trip.name) private readonly tripModel: Model<Trip>,
    @InjectModel(TripParticipant.name) private readonly participantModel: Model<TripParticipant>,
    private readonly audit: AuditService,
  ) {}

  private generateTripCode(): string {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `TS-${suffix}`;
  }

  private async createUniqueTripCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateTripCode();
      const existing = await this.tripModel.findOne({ tripCode: code }).lean();

      if (!existing) {
        return code;
      }
    }

    throw new Error('Unable to generate unique trip code');
  }

  async createTrip(createTripDto: CreateTripDto, hostId: string): Promise<any> {
    // Validate dates
    if (createTripDto.startDate && createTripDto.endDate) {
      if (createTripDto.endDate <= createTripDto.startDate) {
        throw new BadRequestException('endDate must be after startDate');
      }
    }

    if (createTripDto.joinOpenUntil && createTripDto.startDate) {
      if (createTripDto.joinOpenUntil > createTripDto.startDate) {
        throw new BadRequestException('joinOpenUntil must be before or equal to startDate');
      }
    }

    const tripCode = await this.createUniqueTripCode();

    const trip = await this.tripModel.create({
      tripCode,
      hostId: new Types.ObjectId(hostId),
      ...createTripDto,
      status: 'draft',
      currentParticipantCount: 1, // host counts as first participant
    });

    await this.audit.logEvent({
      type: 'trip.create',
      tripId: trip._id.toString(),
      hostId,
      tripCode,
    });

    return trip;
  }

  async getTrip(tripId: string): Promise<any> {
    const trip = await this.tripModel.findById(tripId).lean();

    if (!trip || trip.isDeleted) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  async listTrips(
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      activityType?: string;
      difficulty?: string;
      province?: string;
      district?: string;
      lng?: number;
      lat?: number;
      maxDistance?: number;
    } = {},
  ): Promise<any> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(Math.max(1, filters.limit || 20), 100);
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { isDeleted: false };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.activityType) {
      query.activityType = filters.activityType;
    }

    if (filters.difficulty) {
      query.difficulty = filters.difficulty;
    }

    if (filters.province) {
      query.province = filters.province;
    }

    if (filters.district) {
      query.district = filters.district;
    }

    // Geospatial query
    if (filters.lng !== undefined && filters.lat !== undefined) {
      const maxDistance = filters.maxDistance || 50000; // default 50km
      query.locationGps = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [filters.lng, filters.lat],
          },
          $maxDistance: maxDistance,
        },
      };
    }

    const [items, total] = await Promise.all([
      this.tripModel.find(query).skip(skip).limit(limit).lean(),
      this.tripModel.countDocuments(query),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateTrip(tripId: string, updateDto: UpdateTripDto, userId: string, isAdmin = false): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip || trip.isDeleted) {
      throw new NotFoundException('Trip not found');
    }

    // Only host or admin can update
    if (!isAdmin && trip.hostId.toString() !== userId) {
      throw new ForbiddenException('Only trip host can update this trip');
    }

    // Validate dates if provided
    const startDate = updateDto.startDate || trip.startDate;
    const endDate = updateDto.endDate || trip.endDate;
    const joinOpenUntil = updateDto.joinOpenUntil || trip.joinOpenUntil;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (joinOpenUntil && startDate && joinOpenUntil > startDate) {
      throw new BadRequestException('joinOpenUntil must be before or equal to startDate');
    }

    Object.assign(trip, updateDto);
    await trip.save();

    await this.audit.logEvent({
      type: 'trip.update',
      tripId,
      userId,
    });

    return trip;
  }

  async deleteTrip(tripId: string, userId: string, isAdmin = false): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Only admin can delete
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can delete trips');
    }

    trip.isDeleted = true;
    await trip.save();

    await this.audit.logEvent({
      type: 'trip.delete',
      tripId,
      adminId: userId,
    });

    return { message: 'Trip deleted' };
  }

  async joinTrip(tripId: string, userId: string): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip || trip.isDeleted) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.status === 'cancelled') {
      throw new BadRequestException('Cannot join a cancelled trip');
    }

    // Check if already a participant
    const existing = await this.participantModel.findOne({
      tripId: new Types.ObjectId(tripId),
      userId: new Types.ObjectId(userId),
    });

    if (existing) {
      throw new ConflictException('User is already a participant in this trip');
    }

    // Check max participants (if no space, add to waitlist)
    const currentCount = await this.participantModel.countDocuments({
      tripId: new Types.ObjectId(tripId),
      status: 'approved',
    });

    let status = 'pending';
    let isWaitlisted = false;

    if (currentCount >= trip.maxParticipants) {
      if (!trip.waitlistEnabled) {
        throw new BadRequestException('Trip is full and waitlist is disabled');
      }
      isWaitlisted = true;
      status = 'pending'; // mark as waitlisted in the pending status
    } else {
      // Auto-approve if joinMode is 'open'
      status = trip.joinMode === 'open' ? 'approved' : 'pending';
    }

    const participant = await this.participantModel.create({
      tripId: new Types.ObjectId(tripId),
      userId: new Types.ObjectId(userId),
      status,
      joinedAt: status === 'approved' ? new Date() : undefined,
    });

    // Update trip participant count if approved
    if (status === 'approved') {
      await this.tripModel.findByIdAndUpdate(tripId, {
        $inc: { currentParticipantCount: 1 },
      });
    } else if (isWaitlisted) {
      await this.tripModel.findByIdAndUpdate(tripId, {
        $inc: { waitlistCount: 1 },
      });
    }

    await this.audit.logEvent({
      type: 'trip.join',
      tripId,
      userId,
      status,
      isWaitlisted,
    });

    return participant;
  }

  async checkIn(tripId: string, userId: string): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip || trip.isDeleted) {
      throw new NotFoundException('Trip not found');
    }

    const participant = await this.participantModel.findOne({
      tripId: new Types.ObjectId(tripId),
      userId: new Types.ObjectId(userId),
      status: 'approved',
    });

    if (!participant) {
      throw new NotFoundException('User is not an approved participant of this trip');
    }

    participant.lastCheckinAt = new Date();
    await participant.save();

    await this.audit.logEvent({
      type: 'trip.checkin',
      tripId,
      userId,
    });

    return { message: 'Check-in recorded', lastCheckinAt: participant.lastCheckinAt };
  }

  async approveParticipant(
    tripId: string,
    userId: string,
    approveDto: ApproveParticipantDto,
    adminId: string,
  ): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip || trip.isDeleted) {
      throw new NotFoundException('Trip not found');
    }

    const participant = await this.participantModel.findOne({
      tripId: new Types.ObjectId(tripId),
      userId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const oldStatus = participant.status;
    participant.status = approveDto.status;

    if (approveDto.status === 'approved') {
      participant.joinedAt = new Date();
      await this.tripModel.findByIdAndUpdate(tripId, {
        $inc: { currentParticipantCount: 1, waitlistCount: oldStatus === 'pending' ? -1 : 0 },
      });
    } else if (approveDto.status === 'rejected' || approveDto.status === 'removed') {
      if (oldStatus === 'approved') {
        await this.tripModel.findByIdAndUpdate(tripId, {
          $inc: { currentParticipantCount: -1 },
        });
      } else if (oldStatus === 'pending') {
        await this.tripModel.findByIdAndUpdate(tripId, {
          $inc: { waitlistCount: -1 },
        });
      }
    }

    await participant.save();

    await this.audit.logEvent({
      type: 'trip.approve_participant',
      tripId,
      userId,
      newStatus: approveDto.status,
      adminId,
      reason: approveDto.reason,
    });

    return participant;
  }

  async getParticipants(tripId: string, page = 1, limit = 20): Promise<any> {
    const trip = await this.tripModel.findById(tripId).lean();

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const skip = (page - 1) * limit;
    const [participants, total] = await Promise.all([
      this.participantModel
        .find({ tripId: new Types.ObjectId(tripId) })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.participantModel.countDocuments({ tripId: new Types.ObjectId(tripId) }),
    ]);

    return {
      items: participants,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async confirmCompletion(tripId: string, confirmDto: ConfirmCompletionDto, adminId: string): Promise<any> {
    const trip = await this.tripModel.findById(tripId);

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const query: Record<string, any> = {
      tripId: new Types.ObjectId(tripId),
      status: 'approved',
    };

    if (confirmDto.userIds && confirmDto.userIds.length > 0) {
      query.userId = {
        $in: confirmDto.userIds.map((id) => new Types.ObjectId(id)),
      };
    }

    const result = await this.participantModel.updateMany(query, {
      completionConfirmed: true,
    });

    trip.xpAwarded = false; // Reset flag to allow XP award
    await trip.save();

    await this.audit.logEvent({
      type: 'trip.confirm_completion',
      tripId,
      adminId,
      confirmedCount: result.modifiedCount,
    });

    return { message: 'Completion confirmed', confirmedCount: result.modifiedCount };
  }
}
