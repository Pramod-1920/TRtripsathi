import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getCloudinaryConfig } from './cloudinary.config';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [ConfigModule],
  controllers: [CloudinaryController],
  providers: [
    CloudinaryService,
    {
      provide: 'CLOUDINARY_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getCloudinaryConfig(configService),
    },
  ],
  exports: ['CLOUDINARY_CONFIG', CloudinaryService],
})
export class CloudinaryModule {}
