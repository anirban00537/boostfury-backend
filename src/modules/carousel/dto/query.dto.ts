import { IsNumber, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCarouselsQueryDto {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  workspaceId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  page: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  pageSize: number;
}

export class GetCarouselQueryDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  workspaceId: string;
}
