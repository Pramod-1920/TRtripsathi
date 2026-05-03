import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    // Track when response is sent
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      
      // Determine emoji based on status code
      let statusEmoji = '✅';
      if (statusCode >= 500) statusEmoji = '🔴';
      else if (statusCode >= 400) statusEmoji = '🟡';
      else if (statusCode >= 300) statusEmoji = '🔵';

      // Main log message
      this.logger.log(
        `${statusEmoji} ${method.padEnd(6)} ${statusCode} ${duration.toString().padStart(4)}ms ${originalUrl}`
      );

      // Warn on slow requests (> 1 second)
      if (duration > 1000) {
        this.logger.warn(
          `🐢 SLOW REQUEST: ${method} ${originalUrl} took ${duration}ms from IP: ${ip}`
        );
      }

      // Log errors with details
      if (statusCode >= 500) {
        this.logger.error(
          `⚠️  SERVER ERROR: ${method} ${originalUrl} returned ${statusCode}`
        );
      }
    });

    next();
  }
}
