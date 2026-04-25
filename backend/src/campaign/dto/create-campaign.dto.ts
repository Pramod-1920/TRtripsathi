import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
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
  province?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  placeName?: string;

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

  @IsIn(['instant', 'scheduled'])
  @IsOptional()
  scheduleType?: 'instant' | 'scheduled';

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsDateString()
  @IsOptional()
  joinOpenDate?: string;

  @IsIn(['open', 'request'])
  @IsOptional()
  joinMode?: 'open' | 'request';

  @IsArray()
  @IsOptional()
  photos?: Array<{ url: string; publicId?: string; caption?: string }>;
}
