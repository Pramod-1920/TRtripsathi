import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SimulateXpDto {
  @ApiProperty({
    example: 'campaign_completed',
    description: 'Event key to evaluate for simulation',
  })
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiPropertyOptional({
    example: '6810f7b7a2f6a859f6ee8f11',
    description: 'Optional profile ID to include real user repeat history and progression state',
  })
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @ApiPropertyOptional({
    example: {
      activityType: 'trek',
      difficulty: 'hard',
      district: 'kathmandu district',
      locationKey: 'shivapuri-peak',
      hiddenGem: true,
      rareRoute: false,
      hostOnly: false,
    },
    description: 'Optional simulation context for rule matching and formula components',
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
