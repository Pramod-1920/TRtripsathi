import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';
import {
  AchievementDefinition,
  AchievementDefinitionSchema,
} from './schemas/achievement-definition.schema';
import { UserAchievement, UserAchievementSchema } from './schemas/user-achievement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AchievementDefinition.name,
        schema: AchievementDefinitionSchema,
      },
      {
        name: UserAchievement.name,
        schema: UserAchievementSchema,
      },
    ]),
  ],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
