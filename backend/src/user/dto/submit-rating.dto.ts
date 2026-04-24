import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitRatingDto {
  @ApiProperty({
    example: '6810f7b7a2f6a859f6ee8f11',
    description: 'Profile ID of user receiving the rating',
  })
  @IsString()
  @IsNotEmpty()
  toProfileId!: string;

  @ApiProperty({
    example: '6810f7b7a2f6a859f6ee8f90',
    description: 'Campaign ID used for rating context and dedupe',
  })
  @IsString()
  @IsNotEmpty()
  campaignId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Great host and well organized trip.' })
  @IsOptional()
  @IsString()
  comment?: string;
}
