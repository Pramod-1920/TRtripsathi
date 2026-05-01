import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaService } from './media.service';
import { MediaUpload, MediaUploadSchema } from './schemas/media-upload.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MediaUpload.name, schema: MediaUploadSchema },
    ]),
  ],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
