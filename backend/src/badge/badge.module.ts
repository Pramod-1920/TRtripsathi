import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BadgeService } from './badge.service';
import { UserBadge, UserBadgeSchema } from './schemas/badge.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserBadge.name, schema: UserBadgeSchema },
    ]),
  ],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
