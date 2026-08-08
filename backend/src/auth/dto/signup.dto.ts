import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { Gender } from '../../user/constants/gender.enum';

export class SignupDto {
  @ApiProperty({
    example: '9876543210',
    description: 'User phone number (10 digits)',
  })
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  @Transform(({ value }) => normalizeNepalPhone(value))
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'John', description: 'User first name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'M', description: 'User middle name' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'User last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    example: 'traveller@example.com',
    description: 'User email address',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;

  @ApiPropertyOptional({ example: 'Kathmandu', description: 'Current address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.PreferNotToSay })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-07-12' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'correct horse battery staple',
    description: 'A password or passphrase between 12 and 128 characters',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password: string;
}

function normalizeNepalPhone(value: unknown) {
  if (typeof value !== 'string') return value;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('977')) {
    digits = digits.slice(3);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}
