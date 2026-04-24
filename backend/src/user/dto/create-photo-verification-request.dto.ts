import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreatePhotoVerificationRequestDto {
  @ApiProperty({ example: '6810f7b7a2f6a859f6ee8f90' })
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/group.jpg' })
  @IsString()
  @IsUrl()
  url!: string;

  @ApiProperty({ enum: ['group', 'solo'], example: 'group' })
  @IsEnum(['group', 'solo'])
  kind!: 'group' | 'solo';
}
