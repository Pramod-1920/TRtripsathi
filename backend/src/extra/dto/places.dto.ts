import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PlaceMunicipalityDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

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
  @IsIn(['add', 'rename', 'delete', 'restore'])
  op!: 'add' | 'rename' | 'delete' | 'restore';

  @IsString()
  @IsIn(['province', 'district', 'municipality'])
  @IsOptional()
  type?: 'province' | 'district' | 'municipality';

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class PatchPlacesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceOperationDto)
  operations!: PlaceOperationDto[];
}
