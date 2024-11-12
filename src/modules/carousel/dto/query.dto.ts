import { IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCarouselsQueryDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  workspaceId: number;

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
  @IsNumber()
  @Type(() => Number)
  id: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  workspaceId: number;
}
