import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ExperienceLevel } from '../constants/experience-level.enum';

export class CreateProfileDto {
  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({ example: 'M', description: 'User middle name' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 25, description: 'User age, must be greater than 8' })
  @Type(() => Number)
  @IsInt()
  @Min(9, { message: 'Age must be greater than 8' })
  age: number;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/profile.jpg',
    description: 'Profile photo URL',
  })
  @IsString()
  @IsNotEmpty()
  profilePhoto: string;

  @ApiProperty({
    example: 'I enjoy trekking and travel planning.',
    description: 'Short bio',
  })
  @IsString()
  @IsNotEmpty()
  bio: string;

  @ApiProperty({ example: 'Kathmandu', description: 'Current location' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 'Bagmati', description: 'Province' })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({ example: 'Kathmandu District', description: 'District' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Near Durbar Marg', description: 'Landmark' })
  @IsString()
  @IsNotEmpty()
  landmark: string;

  @ApiProperty({
    enum: ExperienceLevel,
    example: ExperienceLevel.Beginner,
    description: 'User experience level',
  })
  @IsEnum(ExperienceLevel)
  experienceLevel: ExperienceLevel;
}
