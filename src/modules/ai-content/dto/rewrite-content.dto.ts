import { IsString, IsNotEmpty } from 'class-validator';

export class RewriteContentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNotEmpty()
  instructions: string;
}
