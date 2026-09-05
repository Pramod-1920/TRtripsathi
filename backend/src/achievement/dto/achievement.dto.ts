import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateIf,
  Min,
} from 'class-validator';

// ──────────────────────────────
// CREATE & UPDATE ACHIEVEMENT DTOs
// ──────────────────────────────

export class CreateAchievementDto {
  @IsString()
  code: string; // e.g., 'DISTRICT_10', 'HIKES_50'

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['exploration', 'hosting', 'skill', 'social', 'special'])
  category: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsEnum(['count', 'value', 'event'])
  conditionType: string;

  @IsString()
  conditionField: string; // e.g., 'districtsVisited', 'xp', 'level'

  @IsOptional()
  @IsEnum(['gte', 'eq', 'lte', 'gt', 'lt'])
  conditionOperator?: string; // default: 'gte'

  @IsNumber()
  @Min(0)
  conditionValue: number;

  @IsOptional()
  @IsString()
  filterField?: string;

  @IsOptional()
  @IsString()
  filterValue?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  xpReward?: number; // default: 0

  @IsOptional()
  @IsString()
  badgeCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // default: true

  @IsOptional()
  @IsBoolean()
  isRepeatable?: boolean; // default: false

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCompletions?: number;
}

export class UpdateAchievementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['exploration', 'hosting', 'skill', 'social', 'special'])
  category?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsEnum(['count', 'value', 'event'])
  conditionType?: string;

  @IsOptional()
  @IsString()
  conditionField?: string;

  @IsOptional()
  @IsEnum(['gte', 'eq', 'lte', 'gt', 'lt'])
  conditionOperator?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  conditionValue?: number;

  @IsOptional()
  @IsString()
  filterField?: string;

  @IsOptional()
  @IsString()
  filterValue?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
  @Min(1)
  maxCompletions?: number;
}

// ──────────────────────────────
// USER ACHIEVEMENT DTOs
// ──────────────────────────────

export class UserAchievementProgressDto {
  achievementId: string;
  code: string;
  name: string;
  category: string;
  progress: number;
  conditionValue: number;
  isCompleted: boolean;
  completedAt?: Date;
  timesCompleted: number;
  xpReward: number;
  badgeCode?: string;
  progressPercentage: number;
}

export class AchievementListResponseDto {
  _id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
  isRepeatable: boolean;
  maxCompletions?: number;
  xpReward: number;
}

export class UserAchievementsResponseDto {
  userId: string;
  totalAchievements: number;
  completedAchievements: number;
  completionPercentage: number;
  achievements: UserAchievementProgressDto[];
}
