import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Strategy } from 'passport-local';
import { AuthService } from 'src/modules/auth/auth.service';
import { PassportStrategy } from '@nestjs/passport';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(email: string, password: string): Promise<any> {
    console.log('password');
    // // const user = await this.authService.validateLocalUser(email, password);
    // if (!user) {
    //   throw new UnauthorizedException();
    // }
    // return user;
  }
}
