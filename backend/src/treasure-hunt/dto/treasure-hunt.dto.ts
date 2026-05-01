import { IsString, IsEnum, IsArray, IsNumber, IsDate, IsOptional, MinLength, MaxLength, Min } from 'class-validator';

// TreasureHunt DTOs

export class CreateTreasureHuntDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  tripId: string;

  @IsArray()
  waypoints: Array<{
    order: number;
    clue: string;
    location: {
      type: string;
      coordinates: [number, number]; // [longitude, latitude]
    };
    radius: number;
    hint?: string;
  }>;

  @IsEnum(['easy', 'medium', 'hard', 'expert'])
  difficulty: string;

  @IsOptional()
  @IsNumber()
  estimatedDurationMinutes: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  xpReward: number;

  @IsDate()
  startDate: Date;

  @IsDate()
  endDate: Date;
}

export class UpdateTreasureHuntDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard', 'expert'])
  difficulty: string;

  @IsOptional()
  @IsDate()
  endDate: Date;

  @IsOptional()
  isActive: boolean;
}

// TreasureProgress DTOs

export class VerifyWaypointDto {
  @IsNumber()
  waypointOrder: number;

  @IsNumber()
  userLatitude: number;

  @IsNumber()
  userLongitude: number;
}

export class TreasureHuntResponseDto {
  _id: string;
  name: string;
  description: string;
  waypoints: any[];
  difficulty: string;
  estimatedDurationMinutes: number;
  xpReward: number;
  createdBy: any;
  tripId?: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export class TreasureProgressResponseDto {
  _id: string;
  userId: string;
  treasureHuntId: string;
  completedWaypoints: Array<{
    waypointOrder: number;
    completedAt: Date;
  }>;
  isWinner: boolean;
  completedAt?: Date;
  timeToCompleteMinutes?: number;
  createdAt: Date;
}
