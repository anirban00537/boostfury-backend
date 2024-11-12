import { Prisma } from '@prisma/client';

/** Describes the properties of an User in the database */
export class User implements Prisma.UserUncheckedCreateInput {
  /**
   * User ID as UUID
   * @example 1
   */
  id?: number;

  /**
   * User email
   * @example "user@example.com"
   */
  email: string;

  /**
   * User password
   * @example "$2b$10$1XpzUYu8FuvuaBb3SC0xzuR9DX7KakbMLt0vLNoZ.UnLntDMFc4LK"
   */
  password: string;

  /**
   * User name
   * @example "John Doe"
   */
  first_name?: string;

  /**
   * User address
   * @example "World Street 0"
   */
  last_name?: string;

  /**
   * User createdAt dateString
   * @example "2022-03-26T15:41:28.527Z"
   */
  createdAt?: string | Date;

  /**
   * User updatedAt dateString
   * @example "2022-03-26T15:41:28.527Z"
   */
  updatedAt?: string | Date;

  /**
   * User login provider
   * @example "email"
   */
  login_provider: string;
}
