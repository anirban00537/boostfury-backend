import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkedInCallbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;
} 