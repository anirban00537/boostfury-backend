import { IsString, IsOptional, IsArray, IsInt, IsEnum } from 'class-validator';

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export class CreateOrUpdateDraftPostDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  content: string;

  @IsEnum(PostType)
  postType: PostType;

  @IsInt()
  workspaceId: number;

  @IsOptional()
  @IsInt()
  linkedInProfileId?: number;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

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
