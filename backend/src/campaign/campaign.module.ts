import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import { CampaignService } from './campaign.service';
import { CampaignScheduler } from './campaign.scheduler';
import { CampaignController } from './campaign.controller';
import { AuditService } from '../audit/audit.service';
import { UserModule } from '../user/user.module';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';
import { ExtraModule } from '../extra/extra.module';
import { NotificationModule } from '../notification/notification.module';
import { VisitedPlaceModule } from '../visited-place/visited-place.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: User.name, schema: UserSchema },
      { name: Auth.name, schema: AuthSchema },
    ]),
    UserModule,
    ExtraModule,
    NotificationModule,
    VisitedPlaceModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, AuditService, CampaignScheduler],
  exports: [CampaignService],
})
export class CampaignModule {}
