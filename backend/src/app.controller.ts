import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { AppService } from './app.service';
import { MetricsService } from './observability/metrics.service';
import { RedisService } from './redis/redis.service';
import type { Response } from 'express';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Returns a greeting message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOkResponse({ description: 'Returns backend and database readiness' })
  getHealth() {
    return this.healthPayload();
  }

  @Get('health/live')
  @ApiOkResponse({ description: 'Returns process liveness' })
  getLiveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  @ApiOkResponse({
    description: 'Returns dependency readiness and HTTP 503 when unavailable',
  })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const redis = await this.redis.health();
    const payload = {
      ...this.healthPayload(),
      redis,
    };
    if (!redis.connected) payload.status = 'degraded';
    if (payload.status !== 'ok') response.status(503);
    return payload;
  }

  @Get('health/metrics')
  @ApiOkResponse({ description: 'Returns bounded process and HTTP metrics' })
  getMetrics(@Headers('x-monitoring-token') token?: string) {
    const expected = process.env.MONITORING_TOKEN?.trim();
    if (
      (expected && token !== expected) ||
      (!expected && process.env.NODE_ENV === 'production')
    ) {
      throw new UnauthorizedException('Invalid monitoring token');
    }
    return this.metrics.snapshot();
  }

  private healthPayload() {
    return {
      status: this.connection.readyState === 1 ? 'ok' : 'degraded',
      database: {
        connected: this.connection.readyState === 1,
        readyState: this.connection.readyState,
        name: this.connection.name,
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
