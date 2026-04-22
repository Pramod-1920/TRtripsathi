import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CloudinaryService } from './cloudinary.service';
import { CloudinarySignatureDto } from './dto/cloudinary-signature.dto';

@ApiTags('Cloudinary')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
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
