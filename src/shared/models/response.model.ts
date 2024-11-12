import { IsBoolean, IsString, isObject } from 'class-validator';

/* eslint-disable @typescript-eslint/ban-types */
export class ResponseModel {
  @IsBoolean()
  success: boolean;

  @IsString()
  message: string;

  data?: object;
}
