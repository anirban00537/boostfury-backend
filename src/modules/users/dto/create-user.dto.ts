import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { User } from '../entities/user.entity';

/** Describes the fields needed to create an User */
export class CreateUserDto implements User {
  /**
   * User name
   * @example "John Doe"
   */
  @IsNotEmpty()
  @IsString()
  first_name: string;

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
  @IsEmail()
  email: string;

  // /**
  //  * User password must contain at least 1 number and 1 letter
  //  * @example "abc123456"
  //  */
  // @IsNotEmpty()
  // @IsString()
  // @MinLength(8, { message: 'Password must have length of at least 8' })
  // @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-z]).*$/, {
  //   message: 'Password must contain at least 1 number and 1 letter',
  // })
  password: string;

  @IsNotEmpty()
  @IsString()
  login_provider: string;
}
