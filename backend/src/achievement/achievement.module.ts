import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';
import {
  AchievementDefinition,
  AchievementDefinitionSchema,
} from './schemas/achievement-definition.schema';
import { UserAchievement, UserAchievementSchema } from './schemas/user-achievement.schema';
import { RankUpAchievement, RankUpAchievementSchema } from './schemas/rank-up-achievement.schema';
import { UserRankUpAchievement, UserRankUpAchievementSchema } from './schemas/user-rank-up-achievement.schema';
import { RankUpAchievementService } from './rank-up-achievement.service';
import { RankUpAchievementController } from './rank-up-achievement.controller';

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
      {
        name: RankUpAchievement.name,
        schema: RankUpAchievementSchema,
      },
      {
        name: UserRankUpAchievement.name,
        schema: UserRankUpAchievementSchema,
      },
    ]),
  ],
  controllers: [AchievementController, RankUpAchievementController],
  providers: [AchievementService, RankUpAchievementService],
  exports: [AchievementService, RankUpAchievementService],
})
export class AchievementModule {}
