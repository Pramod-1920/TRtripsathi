import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsLatitude,
  IsLongitude,
  IsInt,
  Max,
  Min,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PlaceTitleDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  subcategory?: string | null;

  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  @IsOptional()
  verificationRadiusMeters?: number;

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;
}

export class PlaceMunicipalityDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceTitleDto)
  @IsOptional()
  places?: PlaceTitleDto[];

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;
}

export class PlaceDistrictDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceMunicipalityDto)
  municipalities!: PlaceMunicipalityDto[];

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;
}

export class PlaceProvinceDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceDistrictDto)
  districts!: PlaceDistrictDto[];

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;
}

export class BulkSeedPlacesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceProvinceDto)
  provinces!: PlaceProvinceDto[];
}

export class PlaceOperationDto {
  @IsString()
  @IsIn(['add', 'rename', 'delete', 'restore', 'hard_delete'])
  op!: 'add' | 'rename' | 'delete' | 'restore' | 'hard_delete';

  @IsString()
  @IsIn(['province', 'district', 'municipality', 'place'])
  @IsOptional()
  type?: 'province' | 'district' | 'municipality' | 'place';

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  subcategory?: string | null;

  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @IsInt()
  @Min(50)
  @Max(10000)
  @IsOptional()
  verificationRadiusMeters?: number;
}

export class PatchPlacesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceOperationDto)
  operations!: PlaceOperationDto[];
}
