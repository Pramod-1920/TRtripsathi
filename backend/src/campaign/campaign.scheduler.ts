import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignService } from './campaign.service';

@Injectable()
export class CampaignScheduler {
  private readonly logger = new Logger(CampaignScheduler.name);

  constructor(private readonly campaignService: CampaignService) {}

  // run every 5 minutes to process verification deadlines and auto-close expired campaigns
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleVerificationCron() {
    try {
      await this.campaignService.runVerificationHousekeeping();
      this.logger.debug('Ran campaign verification housekeeping');
    } catch (err) {
      this.logger.error('Error running campaign verification housekeeping', err as any);
    }
  }
}
