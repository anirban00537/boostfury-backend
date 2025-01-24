import { IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateAiStyleDto {
  @IsString()
  @IsOptional()
  professionalIdentity?: string;

  @IsArray()
  @IsOptional()
  contentTopics?: string[];
}
