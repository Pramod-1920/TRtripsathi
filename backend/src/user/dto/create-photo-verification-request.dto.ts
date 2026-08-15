import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreatePhotoVerificationRequestDto {
  @ApiProperty({ example: '6810f7b7a2f6a859f6ee8f90' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/group.jpg',
  })
  @IsString()
  @IsUrl()
  url!: string;

  @ApiProperty({ enum: ['group', 'solo'], example: 'group' })
  @IsEnum(['group', 'solo'])
  kind!: 'group' | 'solo';

  @ApiProperty({ example: 'Evening visit to Pashupatinath' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'temple_spiritual' })
  @IsOptional()
  @IsEnum([
    'heritage_culture',
    'temple_spiritual',
    'nature',
    'adventure',
    'food_local',
    'community_event',
    'hidden_gem',
    'other',
  ])
  category?: string;

  @ApiProperty({ example: 'BAGMATI PROVINCE' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ example: 'KATHMANDU' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Kathmandu Metropolitan City' })
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiProperty({ example: 'PASHUPATINATH TEMPLE' })
  @IsOptional()
  @IsString()
  place?: string;

  @ApiProperty({ example: 'Gaushala, Kathmandu' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  address?: string;

  @ApiProperty({ example: 27.7104, required: false })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiProperty({ example: 85.3488, required: false })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
