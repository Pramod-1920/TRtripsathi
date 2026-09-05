import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TreasureHuntController } from './treasure-hunt.controller';
import { TreasureHuntService } from './treasure-hunt.service';
import {
  TreasureHunt,
  TreasureHuntSchema,
} from './schemas/treasure-hunt.schema';
import {
  TreasureProgress,
  TreasureProgressSchema,
} from './schemas/treasure-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TreasureHunt.name, schema: TreasureHuntSchema },
      { name: TreasureProgress.name, schema: TreasureProgressSchema },
    ]),
  ],
  controllers: [TreasureHuntController],
  providers: [TreasureHuntService],
  exports: [TreasureHuntService],
})
export class TreasureHuntModule {}
