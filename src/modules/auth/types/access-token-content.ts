/** What is returned to the application after Access JsonWebToken is validated */
export type AccessTokenContent = {
  /** User ID
   * @example 1
   */
  userId: number;

  /** User email
   * @example "email"
   */
  email: string;
};
