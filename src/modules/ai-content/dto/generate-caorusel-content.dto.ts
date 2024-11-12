import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class GenerateCarouselContentDto {
  @IsString()
  topic: string;

  @IsNumber()
  numSlides: number;

  @IsString()
  language: string;

  @IsString()
  mood: string;

  @IsString()
  theme: string;

  @IsString()
  contentStyle: string;

  @IsString()
  targetAudience: string;

  @IsBoolean()
  themeActive: boolean;
}
