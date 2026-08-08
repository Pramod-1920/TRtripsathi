import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  Max,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ExperienceLevel } from '../../auth/constants/experience-level.enum';
import { Gender } from '../constants/gender.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: '9876543210',
    description: 'User phone number (10 digits)',
  })
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'admin@example.com',
    description: 'User email address',
  })
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
    example: 25,
    description: 'User age between 9 and 120',
  })
  @IsOptional()
  @IsInt()
  @Min(9)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({
    example: '1995-07-12',
    description:
      'Date of birth in YYYY-MM-DD format. Age is calculated automatically.',
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

  @ApiPropertyOptional({
    example: 'I enjoy trekking and travel planning.',
    description: 'Short bio',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: 'Kathmandu',
    description: 'Current location',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Bagmati', description: 'Province' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({
    example: 'Kathmandu District',
    description: 'District',
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Near Durbar Marg', description: 'Landmark' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    example: ExperienceLevel.F,
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
    enum: ['new_explorer', 'trail_regular', 'expedition_ready'],
    example: 'trail_regular',
    description: 'Self-described travel experience, separate from earned rank',
  })
  @IsOptional()
  @IsIn(['new_explorer', 'trail_regular', 'expedition_ready'])
  travelerExperience?: string;

  @ApiPropertyOptional({
    enum: ['solo', 'small_group', 'open_to_all'],
    example: 'small_group',
  })
  @IsOptional()
  @IsIn(['solo', 'small_group', 'open_to_all'])
  travelStyle?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['trekking', 'culture', 'photography'],
    description: 'Two to eight activities used for travel matching',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  travelInterests?: string[];

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether profile can be viewed in public search and profile listing',
  })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;
}
