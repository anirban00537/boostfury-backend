import { IsString, IsOptional } from 'class-validator';

export class GeneratePersonalizedPostDto {
  @IsString()
  linkedInProfileId: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  postLength?: 'short' | 'medium' | 'long';
}
