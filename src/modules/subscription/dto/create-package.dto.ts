import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
} from 'class-validator';

// Define package types and status as enums for better type safety
export enum PackageType {
  TRIAL = 'trial',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

export enum PackageStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

// Define feature flags as enum for consistency
export enum PackageFeatures {
  VIRAL_POST_GENERATION = 1,
  AI_STUDIO = 2,
  POST_IDEA_GENERATOR = 3,
}

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(PackageType)
  @IsNotEmpty()
  type: PackageType;

  @IsEnum(PackageStatus)
  @IsOptional()
  status: PackageStatus = PackageStatus.ACTIVE;

  @IsNumber()
  @IsOptional()
  @Min(1)
  trial_duration_days?: number;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  currency: string = 'USD';

  @IsString()
  @IsNotEmpty()
  variantId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  monthlyWordLimit: number;

  @IsArray()
  @IsOptional()
  featuresList: string[] = [];

  @IsArray()
  @IsOptional()
  features: PackageFeatures[] = [];
}
