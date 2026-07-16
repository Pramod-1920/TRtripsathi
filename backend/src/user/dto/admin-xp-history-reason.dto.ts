import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminXpHistoryReasonDto {
  @ApiProperty({
    example: 'Duplicate fraudulent XP entry removed after review',
    description: 'Admin reason for deleting XP history entry',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
