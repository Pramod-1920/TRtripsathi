import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class TriggerXpEventDto {
  @ApiProperty({
    example: 'campaign_completed',
    description: 'Event key to evaluate against enabled XP rules',
  })
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiPropertyOptional({
    example: {
      campaignId: '6810f7b7a2f6a859f6ee8f11',
      difficulty: 'moderate',
      district: 'kathmandu district',
      solo: false,
      rating: 5,
      hostOnly: false,
      referredUserId: '6810f7b7a2f6a859f6ee8f15',
    },
    description: 'Optional event metadata for rule condition/repeat matching',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
