import { IsString, IsNumber, IsOptional, Min, Max, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ReviewResponseDto {
  _id: string;
  reviewerId: string;
  revieweeId: string;
  tripId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewStatsDto {
  userId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
}
