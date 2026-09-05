import {
  IsString,
  IsArray,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export enum RankCode {
  E = 'E',
  D = 'D',
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S',
  SS = 'SS',
  SSS = 'SSS',
}

export enum ActivityType {
  HIKE = 'hike',
  TREK = 'trek',
  HERITAGE = 'heritage',
  NATURAL_RESOURCE = 'natural_resource',
  ADVENTURE = 'adventure',
  HIDDEN_GEMS = 'hidden_gems',
}

export enum ConditionType {
  COUNT = 'count',
  VALUE = 'value',
  EVENT = 'event',
}

export enum ConditionOperator {
  GTE = 'gte',
  EQ = 'eq',
  LTE = 'lte',
  GT = 'gt',
  LT = 'lt',
}

export class CreateRankUpAchievementDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(RankCode)
  targetRank: RankCode;

  @IsArray()
  @IsEnum(ActivityType, { each: true })
  activityTypes: ActivityType[];

  @IsEnum(ConditionType)
  conditionType: ConditionType;

  @IsString()
  conditionField: string;

  @IsEnum(ConditionOperator)
  conditionOperator?: ConditionOperator;

  @IsNumber()
  conditionValue: number;

  @IsOptional()
  @IsString()
  filterField?: string;

  @IsOptional()
  @IsString()
  filterValue?: string;

  @IsNumber()
  minLevel: number;

  @IsOptional()
  @IsNumber()
  minXp?: number;

  @IsOptional()
  @IsNumber()
  xpReward?: number;

  @IsOptional()
  @IsString()
  badgeCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRepeatable?: boolean;

  @IsOptional()
  @IsNumber()
  maxCompletions?: number;
}

export class UpdateRankUpAchievementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RankCode)
  targetRank?: RankCode;

  @IsOptional()
  @IsArray()
  @IsEnum(ActivityType, { each: true })
  activityTypes?: ActivityType[];

  @IsOptional()
  @IsEnum(ConditionType)
  conditionType?: ConditionType;

  @IsOptional()
  @IsString()
  conditionField?: string;

  @IsOptional()
  @IsEnum(ConditionOperator)
  conditionOperator?: ConditionOperator;

  @IsOptional()
  @IsNumber()
  conditionValue?: number;

  @IsOptional()
  @IsString()
  filterField?: string;

  @IsOptional()
  @IsString()
  filterValue?: string;

  @IsOptional()
  @IsNumber()
  minLevel?: number;

  @IsOptional()
  @IsNumber()
  minXp?: number;

  @IsOptional()
  @IsNumber()
  xpReward?: number;

  @IsOptional()
  @IsString()
  badgeCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRepeatable?: boolean;

  @IsOptional()
  @IsNumber()
  maxCompletions?: number;
}

export class RankUpAchievementResponseDto {
  id: string;
  code: string;
  name: string;
  description: string;
  targetRank: RankCode;
  activityTypes: ActivityType[];
  conditionType: ConditionType;
  conditionField: string;
  conditionOperator: ConditionOperator;
  conditionValue: number;
  filterField: string;
  filterValue: string;
  minLevel: number;
  minXp: number;
  xpReward: number;
  badgeCode: string;
  isActive: boolean;
  isRepeatable: boolean;
  maxCompletions: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRankUpAchievementResponseDto {
  id: string;
  userId: string;
  rankUpAchievementId: string;
  progress: number;
  isCompleted: boolean;
  completedAt: Date;
  timesCompleted: number;
  lastCompletedAt: Date;
  rankedUpTo: RankCode;
  createdAt: Date;
  updatedAt: Date;
}

export class RankUpValidationResponseDto {
  targetRank: RankCode;
  isEligible: boolean;
  completedAchievements: number;
  totalRequiredAchievements: number;
  achievementStatus: {
    code: string;
    name: string;
    isCompleted: boolean;
    progress: number;
    required: number;
  }[];
  reason?: string;
}
