import { IsBoolean, IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ExtraCategory } from '../constants/extra-category.enum';

export class CreateExtraDto {
  @IsEnum(ExtraCategory)
  category!: ExtraCategory;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}