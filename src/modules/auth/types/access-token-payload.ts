/** Decrypted Access JsonWebToken content */
export type AccessTokenPayload = {
  /** Token subject, user ID used
   * @example 1
   */
  sub: number;

  /** User email
   * @example "email"
   */
  email: string;
};
