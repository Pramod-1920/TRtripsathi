import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BadgeService } from './badge.service';
import { BadgeController } from './badge.controller';
import { UserBadge, UserBadgeSchema } from './schemas/badge.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserBadge.name, schema: UserBadgeSchema },
    ]),
    forwardRef(() => UserModule),
  ],
  controllers: [BadgeController],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
