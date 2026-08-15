import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestContactVerificationDto {
  @ApiProperty({ enum: ['email', 'sms'] })
  @IsIn(['email', 'sms'])
  channel!: 'email' | 'sms';
}

export class ConfirmAuthCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Code must contain exactly 6 digits' })
  code!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'traveller@example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  identifier!: string;
}

export class ResetPasswordDto extends ConfirmAuthCodeDto {
  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password!: string;
}
