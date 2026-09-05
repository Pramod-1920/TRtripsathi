import { ApiProperty } from '@nestjs/swagger';

export class AwardBadgeDto {
  @ApiProperty({ description: 'Badge code (rank code)', example: 'A' })
  badgeCode!: string;

  @ApiProperty({ description: 'Display name for the badge', example: 'A' })
  name!: string;

  @ApiProperty({ description: 'Public URL to the badge icon' })
  iconUrl!: string;

  @ApiProperty({
    description: 'Optional tier (grouping) for the badge',
    required: false,
  })
  tier?: string;

  @ApiProperty({
    description: 'Optional description for the badge',
    required: false,
  })
  description?: string;
}
