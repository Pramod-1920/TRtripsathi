import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Registered Nepal phone number',
  })
  @Transform(({ value }) => normalizeNepalPhone(value))
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phoneNumber!: string;

  @ApiProperty({ example: 'Password@123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
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
