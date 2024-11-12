import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Express } from 'express';

export class CreateUpdateBrandingDto {
  @ApiProperty({ description: 'The name of the brand' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'The handle or username for the brand' })
  @IsNotEmpty()
  @IsString()
  handle: string;

  @ApiProperty({ 
    description: 'The headshot image file', 
    type: 'string', 
    format: 'binary',
    required: false 
  })
  @IsOptional()
  headshot?: Express.Multer.File;
}
