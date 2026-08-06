import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Returns a greeting message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOkResponse({ description: 'Returns backend and database readiness' })
  getHealth() {
    return {
      status: this.connection.readyState === 1 ? 'ok' : 'degraded',
      database: {
        connected: this.connection.readyState === 1,
        readyState: this.connection.readyState,
        name: this.connection.name,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
