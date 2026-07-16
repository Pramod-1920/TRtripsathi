import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransitionCampaignPhaseDto {
  @IsIn(['draft', 'open', 'planning', 'verification', 'ready', 'started', 'completed', 'cancelled'])
  toPhase!: 'draft' | 'open' | 'planning' | 'verification' | 'ready' | 'started' | 'completed' | 'cancelled';

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UpdateParticipantRoleDto {
  @IsIn(['host', 'co-host', 'member'])
  role!: 'host' | 'co-host' | 'member';
}

export class UpdatePlanningCostsDto {
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

export class UpdatePlanningDto {
  @IsString()
  @IsOptional()
  transportDecision?: string;

  @IsString()
  @IsOptional()
  meetingPoint?: string;

  @IsString()
  @IsOptional()
  meetingTime?: string;

  @ValidateNested()
  @Type(() => UpdatePlanningCostsDto)
  @IsOptional()
  costBreakdown?: UpdatePlanningCostsDto;
}

export class AddTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsMongoId()
  @IsOptional()
  assignedUserId?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsMongoId()
  @IsOptional()
  assignedUserId?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

export class VerifyPlanningRejectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

