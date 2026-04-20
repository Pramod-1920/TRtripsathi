import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloudinarySignatureDto {
  @ApiProperty({ 
    example: 'profile_images', 
    description: 'Optional folder path in Cloudinary',
    required: false 
  })
  @IsOptional()
  @IsString()
  folder?: string;
}
