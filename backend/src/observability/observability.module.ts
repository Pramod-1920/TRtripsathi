import { Global, Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [MetricsService, AlertService],
  exports: [MetricsService, AlertService],
})
export class ObservabilityModule {}
