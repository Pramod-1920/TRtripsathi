import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ExperienceLevel } from '../../auth/constants/experience-level.enum';

export class UpdateProfileDto {
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

  @ApiPropertyOptional({ example: 25, description: 'User age, must be greater than 8' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(9, { message: 'Age must be greater than 8' })
  age?: number;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/profile.jpg',
    description: 'Profile photo URL',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

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
    example: true,
    description: 'Whether profile can be viewed in public search and profile listing',
  })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;
}
