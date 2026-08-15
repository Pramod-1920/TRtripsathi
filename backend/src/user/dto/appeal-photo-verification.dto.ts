import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AppealPhotoVerificationDto {
  @ApiProperty({
    example: 'I retook the GPS reading at the entrance; please review again.',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  appealNote!: string;
}
