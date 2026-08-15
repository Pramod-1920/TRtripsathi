import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminWeatherController } from './admin-weather.controller';
import { AdminWeatherService } from './admin-weather.service';
import { AdminNotificationController } from './admin-notification.controller';
import { AdminNotificationService } from './admin-notification.service';
import {
  AdminNotificationState,
  AdminNotificationStateSchema,
} from './schemas/admin-notification-state.schema';
import { Report, ReportSchema } from '../report/schemas/report.schema';
import { Campaign, CampaignSchema } from '../campaign/schemas/campaign.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Auth, AuthSchema } from '../auth/schemas/auth.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AdminNotificationState.name,
        schema: AdminNotificationStateSchema,
      },
      { name: Report.name, schema: ReportSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: User.name, schema: UserSchema },
      { name: Auth.name, schema: AuthSchema },
    ]),
  ],
  controllers: [AdminWeatherController, AdminNotificationController],
  providers: [AdminWeatherService, AdminNotificationService],
  exports: [AdminWeatherService],
})
export class AdminModule {}
