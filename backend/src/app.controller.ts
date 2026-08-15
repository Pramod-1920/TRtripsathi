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
import type { Response } from 'express';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
    private readonly metrics: MetricsService,
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
  getReadiness(@Res({ passthrough: true }) response: Response) {
    const payload = this.healthPayload();
    if (payload.status !== 'ok') response.status(503);
    return payload;
  }

  @Get('health/metrics')
  @ApiOkResponse({ description: 'Returns bounded process and HTTP metrics' })
  getMetrics(@Headers('x-monitoring-token') token?: string) {
    const expected = process.env.MONITORING_TOKEN?.trim();
    if (
      process.env.NODE_ENV === 'production' &&
      (!expected || token !== expected)
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
