import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class RewriteContentDto {
  @IsString()
  @IsNotEmpty()
  linkedInPostId: string;

  @IsNumber()
  @Min(1)
  @Max(9)
  instructionType: number;
}
