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
import { LinkedInLoginDto } from './dto/linkedin-login.dto';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ApiOperation } from '@nestjs/swagger';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';

@Controller('auth')
export class AuthController {
  private stateMap: Map<string, string> = new Map();

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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

  @Public()
  @Post('admin-login')
  adminLogin(@Body() payload: LoginCredentialsDto): Promise<ResponseModel> {
    return this.authService.adminLogin(payload);
  }

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

  @Post('logout')
  async logout(@Body() { refreshToken }: LogoutDto) {
    return this.authService.logout(refreshToken);
  }

  @Post('logoutAll')
  async logoutAll(@Req() request: Request) {
    const { userId } = request.body.user as { userId: string };
    return this.authService.logoutAll(userId);
  }

  @Get('tokens')
  async findAllTokens(@Req() request: Request): Promise<UserTokens[]> {
    const { userId } = request.body.user as { userId: string };
    return this.authService.findAllTokens(userId);
  }

  @Public()
  @Post('google-login')
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
  ): Promise<ResponseModel> {
    return this.authService.googleLogin(googleLoginDto);
  }

  @Public()
  @Get('linkedin-auth/auth-url')
  @ApiOperation({ summary: 'Get LinkedIn authorization URL for login' })
  getLinkedInAuthUrl(): ResponseModel {
    try {
      const clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
      const redirectUri = this.configService.get<string>(
        'LINKEDIN_LOGIN_REDIRECT_URI',
      );
      const state = uuidv4();

      // Store state for verification during callback
      this.stateMap.set(state, 'auth-flow');
      console.log(`Generated state for auth flow:`, state);

      // Using the working scope configuration
      const scope = [
        'openid', // OpenID Connect
        'profile', // Profile access
        'w_member_social', // Social interactions
        'email', // Email access
      ].join(' ');

      const url =
        `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `auth_type=AC`; // Add auth_type parameter

      return successResponse('LinkedIn auth URL generated successfully', {
        url,
        state,
      });
    } catch (error) {
      console.error('Error generating LinkedIn auth URL:', error);
      return errorResponse('Failed to generate LinkedIn auth URL');
    }
  }

  @Public()
  @Post('linkedin-login')
  @ApiOperation({ summary: 'Handle LinkedIn OAuth callback and login' })
  async linkedinLogin(
    @Body() linkedinLoginDto: LinkedInLoginDto,
  ): Promise<ResponseModel> {
    const { state } = linkedinLoginDto;

    // Verify state to prevent CSRF attacks
    if (!this.stateMap.has(state)) {
      return errorResponse('Invalid state parameter');
    }

    // Clean up state after verification
    this.stateMap.delete(state);

    return this.authService.linkedinLogin(linkedinLoginDto);
  }
}
