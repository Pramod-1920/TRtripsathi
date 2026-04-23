import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsArray,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsNumber()
  @IsOptional()
  durationDays?: number;

  @IsNumber()
  @IsOptional()
  maxParticipants?: number;

  @IsNumber()
  @IsOptional()
  estimatedNPR?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  joinOpenDate?: string;

  @IsEnum(['open', 'request'])
  @IsOptional()
  joinMode?: 'open' | 'request';

  @IsArray()
  @IsOptional()
  photos?: Array<{ url: string; publicId?: string; caption?: string }>;
}
