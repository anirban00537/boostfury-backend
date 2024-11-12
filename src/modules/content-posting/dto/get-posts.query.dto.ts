import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { coreConstant } from 'src/shared/helpers/coreConstant';

export class GetPostsQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number = 10;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  status: number = coreConstant.POST_STATUS.DRAFT;

  @IsOptional()
  @IsString()
  workspace_id?: string;
}
