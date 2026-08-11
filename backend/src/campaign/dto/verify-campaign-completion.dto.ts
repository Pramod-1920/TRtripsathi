import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class VerifyCampaignCompletionDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/trip-proof.jpg',
    description: 'Uploaded image or video used as proof of trip completion',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @ApiProperty({ enum: ['image', 'video'] })
  @IsIn(['image', 'video'])
  mediaType!: 'image' | 'video';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  publicId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;
}
