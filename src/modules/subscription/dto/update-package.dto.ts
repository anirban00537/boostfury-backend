import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  IsBoolean,
  Min,
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

  @IsBoolean()
  @IsOptional()
  is_trial_package?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1)
  trial_duration_days?: number;

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
