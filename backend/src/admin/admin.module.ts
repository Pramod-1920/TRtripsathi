import { Module } from '@nestjs/common';
import { AdminWeatherController } from './admin-weather.controller';
import { AdminWeatherService } from './admin-weather.service';

@Module({
  controllers: [AdminWeatherController],
  providers: [AdminWeatherService],
  exports: [AdminWeatherService],
})
export class AdminModule {}
