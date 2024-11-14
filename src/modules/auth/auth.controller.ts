import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupCredentialsDto } from './dto/signup-credentials.dto';
import { LoginCredentialsDto } from './dto/login-credentials.dto';
import { LoginResponse } from './dto/login.response';
import { Request } from 'express';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { UserTokens } from '@prisma/client';
import { ForgotCredentialsDto } from './dto/forgot-credentials.dto';
import { Public } from 'src/shared/decorators/public.decorator';
import { VerifyEmailCredentialsDto } from './dto/verify-email-credentials.dto';
import { ResetPasswordCredentialsDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ResponseModel } from 'src/shared/models/response.model';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() payload: SignupCredentialsDto) {
    return this.authService.signup(payload);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() payload: ForgotCredentialsDto) {
    return this.authService.forgotEmail(payload);
  }
  @Public()
  @Post('reset-password')
  resetPassword(@Body() payload: ResetPasswordCredentialsDto) {
    return this.authService.resetPassword(payload);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() payload: VerifyEmailCredentialsDto) {
    return this.authService.verifyEmail(payload);
  }

  @Public()
  @Post('login')
  async login(
    @Body() payload: LoginCredentialsDto,
    @Req() request: Request,
  ): Promise<ResponseModel> {
    const browserInfo =
      `${request.ip} ${request.headers['user-agent']} ${request.headers['accept-language']}`.replace(
        / undefined/g,
        '',
      );

    return this.authService.login(payload, browserInfo);
  }

  /** Refreshes the user token for silent authentication */

  @Post('token-refresh')
  async refreshToken(
    @Body() { refreshToken }: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<LoginResponse> {
    const browserInfo =
      `${request.ip} ${request.headers['user-agent']} ${request.headers['accept-language']}`.replace(
        / undefined/g,
        '',
      );

    return this.authService.refreshToken(refreshToken, browserInfo);
  }

  /** Logs out the User from the current session */

  @Post('logout')
  async logout(@Body() { refreshToken }: LogoutDto) {
    return this.authService.logout(refreshToken);
  }

  /** Logs out the User from all sessions */

  @Post('logoutAll')
  async logoutAll(@Req() request: Request) {
    const { userId } = request.body.user as { userId: string };

    return this.authService.logoutAll(userId);
  }

  /** Returns all user's active tokens */

  @Get('tokens')
  async findAllTokens(@Req() request: Request): Promise<UserTokens[]> {
    const { userId } = request.body.user as { userId: string };

    return this.authService.findAllTokens(userId);
  }

  @Public()
  @Post('google-login')
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto): Promise<ResponseModel> {
    return this.authService.googleLogin(googleLoginDto);
  }
}
