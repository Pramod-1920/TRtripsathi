import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AlertService } from './observability/alert.service';
import { MetricsService } from './observability/metrics.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(
    private readonly metrics: MetricsService,
    private readonly alerts: AlertService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const path = originalUrl.split('?')[0];
    const start = Date.now();
    this.metrics.beginRequest();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const statusCode = res.statusCode;
      this.metrics.finishRequest(statusCode, durationMs);
      this.alerts.recordStatus(statusCode, { method, path, durationMs });
      this.logger.log({
        event: 'http_request',
        method,
        path,
        statusCode,
        durationMs,
        ip,
      });
      if (durationMs > 1000)
        this.logger.warn({
          event: 'slow_request',
          method,
          path,
          durationMs,
          ip,
        });
      if (statusCode >= 500)
        this.logger.error({
          event: 'server_error',
          method,
          path,
          statusCode,
          durationMs,
        });
    });
    next();
  }
}
