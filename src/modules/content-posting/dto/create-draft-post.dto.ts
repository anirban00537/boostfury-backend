import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export class CreateOrUpdateDraftPostDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  content: string;

  @IsEnum(PostType)
  postType: PostType;

  @IsString()
  workspaceId: string;

  @IsOptional()
  @IsString()
  linkedInProfileId?: string;


  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  mentions?: string[];

  @IsOptional()
  @IsString()
  carouselTitle?: string;

  @IsOptional()
  @IsString()
  videoTitle?: string;
}
