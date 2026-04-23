import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { AuditService } from '../audit/audit.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
    ]),
    UserModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, AuditService],
  exports: [CampaignService],
})
export class CampaignModule {}
