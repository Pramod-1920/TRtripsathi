import {
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  IsArray,
  Min,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

class CampaignPhotoDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  publicId?: string;

  @IsString()
  @IsOptional()
  caption?: string;
}

class CampaignTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsMongoId()
  @IsOptional()
  assignedUserId?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

class CampaignCostBreakdownDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  transport?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  food?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  guide?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  misc?: number;
}

class CampaignPlanningDto {
  @IsString()
  @IsOptional()
  transportDecision?: string;

  @IsString()
  @IsOptional()
  meetingPoint?: string;

  @IsDateString()
  @IsOptional()
  meetingTime?: string;

  @ValidateNested()
  @Type(() => CampaignCostBreakdownDto)
  @IsOptional()
  costBreakdown?: CampaignCostBreakdownDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTaskDto)
  @IsOptional()
  tasks?: CampaignTaskDto[];
}

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
  municipality?: string;

  @IsString()
  @IsOptional()
  placeName?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsIn(['solo', 'group'])
  @IsNotEmpty()
  hikeType!: 'solo' | 'group';

  @IsNumber()
  @IsOptional()
  durationDays?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  minParticipants?: number;

  @IsNumber()
  @Min(0)
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

  @IsIn(['all', 'male', 'female'])
  @IsOptional()
  genderVisibility?: 'all' | 'male' | 'female';

  @IsIn(['public', 'private'])
  @IsOptional()
  visibility?: 'public' | 'private';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignPhotoDto)
  @IsOptional()
  photos?: CampaignPhotoDto[];

  @IsIn([
    'draft',
    'open',
    'planning',
    'verification',
    'ready',
    'started',
    'completed',
    'cancelled',
  ])
  @IsOptional()
  lifecyclePhase?:
    | 'draft'
    | 'open'
    | 'planning'
    | 'verification'
    | 'ready'
    | 'started'
    | 'completed'
    | 'cancelled';

  @ValidateNested()
  @Type(() => CampaignPlanningDto)
  @IsOptional()
  planning?: CampaignPlanningDto;
}
