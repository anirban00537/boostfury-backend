import { User } from '@prisma/client';

/** Describes the response received when the Login route is successfully called */
export class UserResponse {
  success: Boolean;
  message: String;
  data: User;
}
