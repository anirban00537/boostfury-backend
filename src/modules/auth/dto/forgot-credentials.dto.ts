import { IsNotEmpty, IsString } from 'class-validator';

/** Describes the information needed to authenticate an User to the application */
export class ForgotCredentialsDto {
  /**
   * User email
   * @example "user@example.com"
   */
  @IsNotEmpty()
  @IsString()
  email: string;
}
