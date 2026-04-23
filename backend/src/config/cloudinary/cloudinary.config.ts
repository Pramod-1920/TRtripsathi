import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary';

export function getCloudinaryConfig(
  configService: ConfigService,
): ConfigOptions {
  const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
  const apiKey = configService.get<string>('CLOUDINARY_API_KEY')?.trim();
  const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET')?.trim();

  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME is required in .env file');
  }

  if (!apiKey) {
    throw new Error('CLOUDINARY_API_KEY is required in .env file');
  }

  if (!apiSecret) {
    throw new Error('CLOUDINARY_API_SECRET is required in .env file');
  }

  const cloudinaryConfig: ConfigOptions = {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  };

  cloudinary.config(cloudinaryConfig);

  return cloudinaryConfig;
}
