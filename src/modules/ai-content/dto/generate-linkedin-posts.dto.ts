import { IsString, IsOptional } from 'class-validator';

export class GenerateLinkedInPostsDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  tone?: string;

}
