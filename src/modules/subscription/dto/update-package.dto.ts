import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';
import {
  PackageType,
  PackageStatus,
  PackageFeatures,
} from './create-package.dto';

export class UpdatePackageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PackageType)
  @IsOptional()
  type?: PackageType;

  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsNumber()
  @IsOptional()
  monthlyWordLimit?: number;

  @IsArray()
  @IsOptional()
  featuresList?: string[];

  @IsArray()
  @IsOptional()
  features?: PackageFeatures[];
}
