import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SetReferrerDto {
  @ApiProperty({
    example: '6810f7b7a2f6a859f6ee8f11',
    description: 'Profile ID of the referrer',
  })
  @IsString()
  @IsNotEmpty()
  referrerProfileId!: string;
}
