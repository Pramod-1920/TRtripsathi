import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Review, ReviewSchema } from './schemas/review.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Trip, TripSchema } from '../trip/schemas/trip.schema';
import {
  TripParticipant,
  TripParticipantSchema,
} from '../trip/schemas/trip-participant.schema';
import { Campaign, CampaignSchema } from '../campaign/schemas/campaign.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: User.name, schema: UserSchema },
      { name: Trip.name, schema: TripSchema },
      { name: TripParticipant.name, schema: TripParticipantSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
