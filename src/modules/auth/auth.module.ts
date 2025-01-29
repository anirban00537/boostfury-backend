import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { accessJwtConfig } from 'src/shared/configs/jwt.config';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessJwtStrategy } from './strategy/access.jwt.strategy';
import { UserVerificationCodeService } from '../verification_code/user-verify-code.service';
// import { LocalStrategy } from "src/common/strategy/local.strategy";
import { ConfigModule } from '@nestjs/config';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserVerificationCodeModule } from '../verification_code/user-verify-code.module';
import { LinkedInStrategy } from './strategies/linkedin.strategy';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: accessJwtConfig.secret,
      signOptions: { expiresIn: accessJwtConfig.expiresIn },
    }),
    ConfigModule,
    UserVerificationCodeModule,
    SubscriptionModule,
  ],
  providers: [
    AuthService,
    AccessJwtStrategy,
    UserVerificationCodeService,
    LinkedInStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
