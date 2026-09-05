import { IsIn, IsOptional } from 'class-validator';

export class MovieStateDto {
  @IsOptional()
  @IsIn(['movie', 'tv'])
  mediaType: 'movie' | 'tv' = 'movie';
}
