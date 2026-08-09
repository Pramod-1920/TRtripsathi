import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VisitedPlaceService } from './visited-place.service';
import {
  VisitedPlace,
  VisitedPlaceSchema,
} from './schemas/visited-place.schema';
import { VisitedPlaceController } from './visited-place.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VisitedPlace.name, schema: VisitedPlaceSchema },
    ]),
    UserModule,
  ],
  controllers: [VisitedPlaceController],
  providers: [VisitedPlaceService],
  exports: [VisitedPlaceService],
})
export class VisitedPlaceModule {}
