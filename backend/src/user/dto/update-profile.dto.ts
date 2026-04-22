import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ExperienceLevel } from '../../auth/constants/experience-level.enum';
import { Gender } from '../constants/gender.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '9876543210', description: 'User phone number (10 digits)' })
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'admin@example.com', description: 'User email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

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
    example: '1995-07-12',
    description: 'Date of birth in YYYY-MM-DD format. Age is calculated automatically.',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/profile.jpg',
    description: 'Profile photo URL',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({
    example: 'admin_profiles/profile_abc123',
    description: 'Cloudinary public ID for profile image management',
  })
  @IsOptional()
  @IsString()
  profilePhotoPublicId?: string;

  @ApiPropertyOptional({ example: 'I enjoy trekking and travel planning.', description: 'Short bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Kathmandu', description: 'Current location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Bagmati', description: 'Province' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'Kathmandu District', description: 'District' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Near Durbar Marg', description: 'Landmark' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    example: ExperienceLevel.Beginner,
    description: 'User experience level',
  })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.PreferNotToSay,
    description: 'User gender',
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    type: [String],
    example: ['English', 'Nepali'],
    description: 'Languages the user knows',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languagesKnown?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Whether profile can be viewed in public search and profile listing',
  })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;
}
