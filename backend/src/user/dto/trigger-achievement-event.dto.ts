import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class TriggerAchievementEventDto {
  @ApiProperty({
    example: 'treks',
    description: 'Achievement subcategory to increment (hikes, treks, temples, routes, quest chains)',
  })
  @IsString()
  @IsNotEmpty()
  subcategory!: string;

  @ApiPropertyOptional({
    example: 'temple_guardian',
    description: 'Optional achievement key to target a specific achievement definition',
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Increment amount for the achievement progress',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}
