import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessTokenPayload } from 'src/modules/auth/types/access-token-payload';
import { User } from '@prisma/client';
import { UsersService } from 'src/modules/users/users.service';
import { accessJwtConfig } from 'src/shared/configs/jwt.config';

@Injectable()
export class AccessJwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessJwtConfig.secret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // console.log('user ...',user)
    return user;
  }
}
