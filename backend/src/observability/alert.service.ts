import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private consecutiveServerErrors = 0;
  private lastAlertAt = 0;

  recordStatus(statusCode: number, details: Record<string, unknown>) {
    if (statusCode < 500) {
      this.consecutiveServerErrors = 0;
      return;
    }
    this.consecutiveServerErrors += 1;
    const threshold = Number(process.env.ALERT_5XX_THRESHOLD ?? 5);
    const cooldownMs = Number(process.env.ALERT_COOLDOWN_MS ?? 300000);
    if (
      this.consecutiveServerErrors < threshold ||
      Date.now() - this.lastAlertAt < cooldownMs
    )
      return;
    this.lastAlertAt = Date.now();
    void this.send('consecutive_5xx', {
      count: this.consecutiveServerErrors,
      ...details,
    });
  }

  async send(type: string, details: Record<string, unknown>) {
    const payload = {
      service: 'tripsathi-backend',
      environment: process.env.NODE_ENV ?? 'development',
      type,
      details,
      timestamp: new Date().toISOString(),
    };
    this.logger.error({ event: 'operational_alert', ...payload });
    const url = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!url) return;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        this.logger.warn(`Alert webhook returned ${response.status}`);
    } catch (error) {
      this.logger.warn('Alert webhook delivery failed', error as Error);
    }
  }
}
