import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsDate, IsArray, Min, Max, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['hike', 'trek', 'heritage', 'natural_resource', 'adventure', 'hidden_gems'])
  @IsNotEmpty()
  activityType: string;

  @IsEnum(['easy', 'moderate', 'difficult', 'expert'])
  @IsNotEmpty()
  difficulty: string;

  @IsEnum(['open', 'approval_required'])
  @IsNotEmpty()
  joinMode: string;

  @IsNumber()
  @Min(2)
  @Max(30)
  @IsNotEmpty()
  maxParticipants: number;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  joinOpenUntil?: Date;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsObject()
  @ValidateNested()
  @IsNotEmpty()
  locationGps: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsOptional()
  waitlistEnabled?: boolean;
}

export class UpdateTripDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['easy', 'moderate', 'difficult', 'expert'])
  @IsOptional()
  difficulty?: string;

  @IsEnum(['open', 'approval_required'])
  @IsOptional()
  joinMode?: string;

  @IsNumber()
  @Min(2)
  @Max(30)
  @IsOptional()
  maxParticipants?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  joinOpenUntil?: Date;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsObject()
  @IsOptional()
  locationGps?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsEnum(['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsOptional()
  waitlistEnabled?: boolean;
}

export class JoinTripDto {
  // No body needed; uses authenticated user context
}

export class CheckinTripDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;
}

export class ApproveParticipantDto {
  @IsEnum(['approved', 'rejected', 'removed'])
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ConfirmCompletionDto {
  @IsArray()
  @IsOptional()
  userIds?: string[]; // If omitted, mark all approved participants as completed
}
