import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const cloudName = this.configService
      .get<string>('CLOUDINARY_CLOUD_NAME')
      ?.trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.configService
      .get<string>('CLOUDINARY_API_SECRET')
      ?.trim();

    if (!cloudName) {
      throw new Error('CLOUDINARY_CLOUD_NAME is required in .env file');
    }

    if (!apiKey) {
      throw new Error('CLOUDINARY_API_KEY is required in .env file');
    }

    if (!apiSecret) {
      throw new Error('CLOUDINARY_API_SECRET is required in .env file');
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
    };
  }

  createUploadSignature(params: { timestamp?: number; folder?: string }) {
    const { apiKey, apiSecret, cloudName } = this.getConfig();
    const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
    const folder = params.folder?.trim();

    const signatureParams: Record<string, string | number> = {
      timestamp,
    };

    if (folder) {
      signatureParams.folder = folder;
    }

    const signature = cloudinary.utils.api_sign_request(
      signatureParams,
      apiSecret,
    );

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: folder ?? undefined,
    };
  }

  async deleteImage(publicId: string) {
    const normalizedPublicId = publicId.trim();

    if (!normalizedPublicId) {
      return;
    }

    const { cloudName, apiKey, apiSecret } = this.getConfig();

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    await cloudinary.uploader.destroy(normalizedPublicId, {
      invalidate: true,
      resource_type: 'image',
    });
  }
}
