import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewPhotoVerificationRequestDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsEnum(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @ApiPropertyOptional({
    example: 'Metadata and visual checks look valid.',
  })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
