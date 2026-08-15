import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private requests = 0;
  private serverErrors = 0;
  private totalDurationMs = 0;
  private activeRequests = 0;
  private readonly statusCounts = new Map<string, number>();

  beginRequest() {
    this.activeRequests += 1;
  }
  finishRequest(statusCode: number, durationMs: number) {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.requests += 1;
    this.totalDurationMs += durationMs;
    if (statusCode >= 500) this.serverErrors += 1;
    const group = `${Math.floor(statusCode / 100)}xx`;
    this.statusCounts.set(group, (this.statusCounts.get(group) ?? 0) + 1);
  }
  snapshot() {
    const memory = process.memoryUsage();
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      requests: {
        total: this.requests,
        active: this.activeRequests,
        serverErrors: this.serverErrors,
        averageDurationMs:
          this.requests === 0
            ? 0
            : Number((this.totalDurationMs / this.requests).toFixed(2)),
        byStatusGroup: Object.fromEntries(this.statusCounts),
      },
      process: {
        pid: process.pid,
        node: process.version,
        memoryBytes: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
