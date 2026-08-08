import { IsBoolean, IsEnum, IsMongoId, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ExtraCategory } from '../constants/extra-category.enum';

export class CreateExtraDto {
  @IsEnum(ExtraCategory)
  category!: ExtraCategory;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsMongoId()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  adminApprovalRequired?: boolean;
}
