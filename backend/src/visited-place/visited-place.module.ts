import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitedPlaceService } from './visited-place.service';
import { VisitedPlace, VisitedPlaceSchema } from './schemas/visited-place.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VisitedPlace.name, schema: VisitedPlaceSchema },
    ]),
  ],
  providers: [VisitedPlaceService],
  exports: [VisitedPlaceService],
})
export class VisitedPlaceModule {}
