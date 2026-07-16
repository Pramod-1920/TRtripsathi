import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Trip, TripSchema } from './schemas/trip.schema';
import { TripParticipant, TripParticipantSchema } from './schemas/trip-participant.schema';
import { TripService } from './trip.service';
import { TripController } from './trip.controller';
import { AuditService } from '../audit/audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Trip.name, schema: TripSchema },
      { name: TripParticipant.name, schema: TripParticipantSchema },
    ]),
  ],
  controllers: [TripController],
  providers: [TripService, AuditService],
  exports: [TripService],
})
export class TripModule {}
