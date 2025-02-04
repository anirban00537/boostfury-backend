import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWebsitePostDto {
  @ApiProperty({
    description: 'The URL of the website to generate content from',
    example: 'https://example.com',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Custom prompt to guide the content generation',
    example: 'Generate a professional LinkedIn post focusing on the company culture and values',
    required: false,
  })
  @IsOptional()
  @IsString()
  customPrompt?: string;
}
