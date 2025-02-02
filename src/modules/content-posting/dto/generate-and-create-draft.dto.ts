import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum PostLength {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

export class GenerateAndCreateDraftDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsNotEmpty()
  linkedInProfileId: string;

  @IsString()
  @IsOptional()
  language?: string = 'en';

  @IsString()
  @IsOptional()
  tone?: string = 'professional';

  @IsEnum(PostLength)
  @IsOptional()
  postLength?: PostLength = PostLength.MEDIUM;

  @IsString()
  @IsOptional()
  category?: string = 'general';
}
