import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MovieQueryDto {
  @IsOptional()
  @IsIn(['movie', 'tv', 'all'])
  mediaType: 'movie' | 'tv' | 'all' = 'movie';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;

  @IsOptional()
  @IsString()
  language = 'en-US';

  @IsOptional()
  @IsString()
  category = 'popular';
}

export class MovieSearchQueryDto extends MovieQueryDto {
  @IsString()
  q: string;
}
