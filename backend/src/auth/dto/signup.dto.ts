import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../constants/roles.enum';

export class SignupDto {
  @ApiProperty({
    example: '9876543210',
    description: 'User phone number (10 digits)',
  })
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phoneNumber: string;

  @ApiProperty({
    example: 'Password@123',
    description:
      'Password with uppercase, lowercase, number and special character',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;

  @ApiProperty({
    example: Role.User,
    enum: Role,
    required: false,
    description: 'Role for the new account. Defaults to user if not provided.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
