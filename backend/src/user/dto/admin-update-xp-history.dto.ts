import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AdminUpdateXpHistoryDto {
  @ApiProperty({
    example: 220,
    description: 'New XP points for this history entry',
  })
  @IsInt()
  @Min(0)
  points!: number;

  @ApiProperty({
    example: 'Manual correction after moderation review',
    description: 'Admin reason for XP adjustment',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
