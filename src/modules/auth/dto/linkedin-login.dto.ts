import { IsNotEmpty, IsString } from 'class-validator';

export class LinkedInLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
