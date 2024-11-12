import { JwtSignOptions } from '@nestjs/jwt';

/** Configurations for the access jsonwebtoken used for authentication */
export const accessJwtConfig: JwtSignOptions = {
  secret: process.env.ACCESS_TOKEN_SECRET,
  expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
};

/** Configurations for the refresh jsonwebtoken used for authentication */
export const refreshJwtConfig: JwtSignOptions = {
  secret: process.env.REFRESH_TOKEN_SECRET,
  // expiresIn: '90d',
  expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
};
