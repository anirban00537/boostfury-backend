import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordCredentialsDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  confirmPassword: string;

  @IsNotEmpty()
  code: string;
}
