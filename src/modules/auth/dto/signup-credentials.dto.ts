import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

/** Describes the information needed to authenticate an User to the application */
export class SignupCredentialsDto {
  /**
   * User name
   * @example "user@example.com"
   */
  @IsNotEmpty()
  @IsString()
  first_name: string;

  @IsNotEmpty()
  @IsString()
  last_name: string;

  @IsNotEmpty()
  @IsString()
  user_name: string;

  /**
   * User email
   * @example "user@example.com"
   */
  @IsNotEmpty()
  @IsString()
  email: string;

  /**
   * User password must contain at least 1 number and 1 letter
   * @example "abc123456"
   */
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must have length of at least 8' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-z]).*$/, {
    message: 'Password must contain at least 1 number and 1 letter',
  })
  password: string;
}
