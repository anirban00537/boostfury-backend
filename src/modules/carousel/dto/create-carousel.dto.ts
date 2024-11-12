import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class CreateCarouselDto {
  @IsObject()
  data: Object;
  @IsNumber()
  workspaceId: number;
}
