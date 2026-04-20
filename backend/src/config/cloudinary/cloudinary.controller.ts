import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import { CloudinarySignatureDto } from './dto/cloudinary-signature.dto';

@ApiTags('Cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('signature')
  @ApiOperation({ summary: 'Get Cloudinary upload signature' })
  @ApiOkResponse({ description: 'Upload signature generated successfully' })
  getSignature(@Body() body: CloudinarySignatureDto) {
    return this.cloudinaryService.createUploadSignature({ folder: body.folder });
  }
}
