import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminWeatherService } from './admin-weather.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminWeatherController {
  constructor(private readonly svc: AdminWeatherService) {}

  @Get('geocode')
  async geocode(@Query('q') q: string): Promise<unknown[]> {
    if (!q) return [];
    return this.svc.geocode(q);
  }

  @Get('weather')
  async weather(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ): Promise<any> {
    if (!lat || !lon) return { error: 'lat and lon required' };
    return this.svc.weatherFor(lat, lon);
  }
}
