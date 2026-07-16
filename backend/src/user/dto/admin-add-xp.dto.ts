import { IsNumber, IsString, Min, Max, MinLength, MaxLength } from 'class-validator';

export class AdminAddXpDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1, { message: 'XP to add must be at least 1' })
  @Max(500, { message: 'XP to add cannot exceed 500 per action' })
  xpToAdd: number;

  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason: string;
}

export class AdminAddXpResponseDto {
  previousXp: number;
  previousLevel: number;
  previousRank: string;
  newXp: number;
  newLevel: number;
  newRank: string;
  xpAdded: number;
  autoRankedUp: boolean;
  newSubRank?: string;
  message: string;
}
