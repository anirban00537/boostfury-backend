import { Injectable, UnauthorizedException } from '@nestjs/common';

import { SignupCredentialsDto } from './dto/signup-credentials.dto';
import { LoginCredentialsDto } from './dto/login-credentials.dto';
import { RefreshTokenPayload } from './types/refresh-token-payload';
import { JwtService } from '@nestjs/jwt';
import { User, UserTokens } from '@prisma/client';
import { InvalidEmailOrPasswordException } from './exceptions/invalid-email-or-password.exception.';
import { InvalidRefreshTokenException } from './exceptions/invalid-refresh-token.exception';
import { compare } from 'bcrypt';
import { v4 as uuidV4 } from 'uuid';
import { ForgotCredentialsDto } from './dto/forgot-credentials.dto';
import { UsersService } from '../users/users.service';
import { ResponseModel } from 'src/shared/models/response.model';
import {
  PrismaClient,
  errorResponse,
  hashedPassword,
  processException,
  successResponse,
} from 'src/shared/helpers/functions';
import { PrismaService } from '../prisma/prisma.service';
import { getTokenExpirationDate } from 'src/shared/utils/getTokenExpirationDate';
import {
  accessJwtConfig,
  refreshJwtConfig,
} from 'src/shared/configs/jwt.config';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { VerifyEmailCredentialsDto } from './dto/verify-email-credentials.dto';
import { UserVerificationCodeService } from '../verification_code/user-verify-code.service';
import { ResetPasswordCredentialsDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { LOGIN_PROVIDER } from 'src/shared/constants/global.constants';
import { SubscriptionService } from '../subscription/subscription.service';
import { LinkedInLoginDto } from './dto/linkedin-login.dto';
import axios from 'axios';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private userService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userVerificationCodeService: UserVerificationCodeService,
    private configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
    );
  }

  async checkEmailNickName(email: string, nickName: string) {
    const checkUniqueEmail = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (checkUniqueEmail) {
      return errorResponse('Email already exists', []);
    }
    const checkUniqueNickName = await this.prisma.user.findUnique({
      where: { user_name: nickName },
    });
    if (checkUniqueNickName) {
      return errorResponse('Nickname already exists', []);
    }
    return successResponse('success', []);
  }

  async signup(payload: SignupCredentialsDto): Promise<ResponseModel> {
    try {
      const checkUniqueEmail = await this.checkEmailNickName(
        payload.email,
        payload.user_name,
      );
      if (checkUniqueEmail.success == false) {
        return checkUniqueEmail;
      }
      const lowerCaseEmail = payload.email.toLocaleLowerCase();
      const hashPassword = await hashedPassword(payload.password);
      const data = {
        ...payload,
        email: lowerCaseEmail,
        password: hashPassword,
        login_provider: LOGIN_PROVIDER.EMAIL,
      };
      const user = await this.userService.createNewUser(data);
      if (user.success === false) {
        return errorResponse('Signup failed! Please try again later');
      }
      return successResponse('Signup successful, Please verify your email');
    } catch (err) {
      processException(err);
    }
  }

  async login(
    payload: LoginCredentialsDto,
    browserInfo?: string,
  ): Promise<ResponseModel> {
    try {
      const user = await this.validateUser(payload.email, payload.password);
      if (user.email_verified !== coreConstant.IS_VERIFIED) {
        return errorResponse(
          'Email is not verified! Please verify your email first.',
        );
      }
      const data = { sub: user.id, email: user.email };

      const accessToken = await this.generateAccessToken(data);
      const refreshToken = await this.createRefreshToken(
        { sub: data.sub, email: data.email },
        browserInfo,
      );

      // Check for existing subscription
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      const trialPackage = await this.prisma.package.findFirst({
        where: { type: coreConstant.PACKAGE_TYPE.TRIAL },
      });

      if (!subscription && trialPackage) {
        await this.subscriptionService.createTrialSubscription(user.id);
      }

      const userData = {
        accessToken,
        refreshToken,
        user,
        isAdmin: user.role === coreConstant.USER_ROLE_ADMIN,
        subscription: await this.prisma.subscription.findUnique({
          where: { userId: user.id },
          include: {
            package: true,
          },
        }),
      };

      return successResponse('Login successful', userData);
    } catch (err) {
      return errorResponse('Invalid email or password');
    }
  }

  async adminLogin(payload: LoginCredentialsDto): Promise<ResponseModel> {
    try {
      const user = await this.validateUser(payload.email, payload.password);
      if (user.role !== coreConstant.USER_ROLE_ADMIN) {
        return errorResponse('Invalid email or password');
      }
      const data = { sub: user.id, email: user.email };

      const accessToken = await this.generateAccessToken(data);
      const refreshToken = await this.createRefreshToken({
        sub: data.sub,
        email: data.email,
      });

      return successResponse('Login successful', {
        accessToken,
        refreshToken,
        user,
      });
    } catch (err) {
      return errorResponse('Invalid email or password');
    }
  }

  async refreshToken(refreshToken: string, browserInfo?: string): Promise<any> {
    try {
      const refreshTokenContent: RefreshTokenPayload =
        await this.jwtService.verifyAsync(refreshToken, refreshJwtConfig);

      await this.validateRefreshToken(refreshToken, refreshTokenContent);

      const accessToken = await this.generateAccessToken({
        sub: refreshTokenContent.sub,
        email: refreshTokenContent.email,
      });

      const newRefreshToken = await this.rotateRefreshToken(
        refreshToken,
        refreshTokenContent,
        browserInfo,
      );

      const userData = {
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        user: [],
      };
      return successResponse('Refresh token', userData);
    } catch (err) {
      console.log(err);
      return errorResponse('Something went wrong', []);
    }
  }

  async logout(refreshToken: string) {
    try {
      await this.prisma.userTokens.deleteMany({ where: { refreshToken } });
      return successResponse('Logout successful', []);
    } catch (err) {
      console.log(err);
      return errorResponse('Something went wrong', []);
    }
  }

  async logoutAll(userId: string) {
    try {
      await this.prisma.userTokens.deleteMany({ where: { userId } });
      return successResponse('Logout successful', []);
    } catch (err) {
      console.log(err);
      return errorResponse('Something went wrong', []);
    }
  }

  async findAllTokens(userId: string): Promise<UserTokens[]> {
    const tokens = await this.prisma.userTokens.findMany({
      where: { userId },
    });

    return tokens;
  }

  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const isPasswordValid = await compare(password, user.password);

      if (isPasswordValid) {
        return { ...user, password: undefined };
      }
    }

    throw new InvalidEmailOrPasswordException();
  }

  private async generateAccessToken(payload: {
    sub: string;
    email: string;
  }): Promise<string> {
    const accessToken = await this.jwtService.sign(payload, accessJwtConfig);

    return accessToken;
  }

  private async generateRefreshToken(payload: {
    sub: string;
    email: string;
    tokenFamily?: string;
  }): Promise<string> {
    if (!payload.tokenFamily) {
      payload.tokenFamily = uuidV4().substring(0, 255);
    }

    return this.jwtService.sign(payload, refreshJwtConfig);
  }

  private async createRefreshToken(
    payload: {
      sub: string;
      email: string;
      tokenFamily?: string;
    },
    browserInfo?: string,
  ): Promise<string> {
    const refreshToken = await this.generateRefreshToken(payload);

    await this.saveRefreshToken({
      userId: payload.sub,
      refreshToken,
      family: payload.tokenFamily || uuidV4().substring(0, 255),
      browserInfo: browserInfo?.substring(0, 255),
    });

    return refreshToken;
  }

  private async saveRefreshToken(refreshTokenCredentials: {
    userId: string;
    refreshToken: string;
    family: string;
    browserInfo?: string;
  }): Promise<void> {
    const expiresAt = getTokenExpirationDate();

    if (!refreshTokenCredentials.userId) {
      throw new Error('User ID is required to save refresh token');
    }

    try {
      await this.prisma.userTokens.create({
        data: {
          userId: refreshTokenCredentials.userId,
          refreshToken: refreshTokenCredentials.refreshToken,
          family: refreshTokenCredentials.family.substring(0, 255),
          browserInfo: refreshTokenCredentials.browserInfo?.substring(0, 255),
          expiresAt,
        },
      });
    } catch (error) {
      throw new Error('Failed to save refresh token');
    }
  }

  private async validateRefreshToken(
    refreshToken: string,
    refreshTokenContent: RefreshTokenPayload,
  ): Promise<boolean> {
    const userTokens = await this.prisma.userTokens.findMany({
      where: { userId: refreshTokenContent.sub, refreshToken },
    });

    const isRefreshTokenValid = userTokens.length > 0;

    if (!isRefreshTokenValid) {
      await this.removeRefreshTokenFamilyIfCompromised(
        refreshTokenContent.sub,
        refreshTokenContent.tokenFamily,
      );

      throw new InvalidRefreshTokenException();
    }

    return true;
  }

  private async removeRefreshTokenFamilyIfCompromised(
    userId: string,
    tokenFamily: string,
  ): Promise<void> {
    const familyTokens = await this.prisma.userTokens.findMany({
      where: { userId, family: tokenFamily },
    });

    if (familyTokens.length > 0) {
      await this.prisma.userTokens.deleteMany({
        where: { userId, family: tokenFamily },
      });
    }
  }

  private async rotateRefreshToken(
    refreshToken: string,
    refreshTokenContent: RefreshTokenPayload,
    browserInfo?: string,
  ): Promise<string> {
    await this.prisma.userTokens.deleteMany({ where: { refreshToken } });

    const newRefreshToken = await this.createRefreshToken(
      {
        sub: refreshTokenContent.sub,
        email: refreshTokenContent.email,
        tokenFamily: refreshTokenContent.tokenFamily,
      },
      browserInfo,
    );

    return newRefreshToken;
  }

  async validateUserByEmail(email: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async forgotEmail(payload: ForgotCredentialsDto): Promise<ResponseModel> {
    try {
      const user = await this.validateUserByEmail(payload.email);
      if (user) {
        await this.userService.sendForgotPasswordEmailProcess(user.email);
        return successResponse(
          'We sent an email code to verify .Please check your email if the email is correct',
          [],
        );
      } else {
        return successResponse(
          'We sent an email code to verify .Please check your email if the email is correct',
          [],
        );
      }
    } catch (err) {
      processException(err);
    }
  }
  async resetPassword(
    payload: ResetPasswordCredentialsDto,
  ): Promise<ResponseModel> {
    try {
      const user = await this.validateUserByEmail(payload.email);
      if (!user) {
        return errorResponse('email does not exist', []);
      }
      const verified = await this.userVerificationCodeService.verifyUserCode(
        user.id,
        payload.code,
        coreConstant.VERIFICATION_TYPE_EMAIL,
      );
      if (verified.success === false) {
        return errorResponse(verified.message);
      }
      const updatedPassword = await PrismaClient.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: (await hashedPassword(payload.password)).toString(),
        },
      });
      if (!updatedPassword) {
        return errorResponse('Password update failed!');
      }
      return successResponse('Password updated successfully');
    } catch (error) {
      processException(error);
    }
  }
  async verifyEmail(
    payload: VerifyEmailCredentialsDto,
  ): Promise<ResponseModel> {
    try {
      const user: User = await this.validateUserByEmail(payload.email);
      if (!user) {
        return errorResponse('Email address doesnot exist!');
      }

      const verified = await this.userVerificationCodeService.verifyUserCode(
        user.id,
        payload.code,
        coreConstant.VERIFICATION_TYPE_EMAIL,
      );

      if (verified.success === false) {
        return errorResponse(verified.message);
      }
      await PrismaClient.user.update({
        where: {
          id: user.id,
        },
        data: {
          email_verified: coreConstant.IS_VERIFIED,
        },
      });
      return successResponse('Verification code successfully validated');
      // if(user.)
    } catch (error) {
      return errorResponse('Invalid email', error);
    }
  }

  async googleLogin(googleLoginDto: GoogleLoginDto): Promise<ResponseModel> {
    try {
      const ticket = await this.verifyGoogleToken(googleLoginDto.idToken);
      const payload = ticket.getPayload();
      const email = payload.email;

      if (!email) {
        throw new UnauthorizedException('Invalid Google account');
      }

      let user = await this.findOrCreateGoogleUser(payload);
      console.log(user.id, 'here is user id');

      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken({ sub: user.id, email: user.email }),
        this.createRefreshToken(
          { sub: user.id, email: user.email },
          'Google Login',
        ),
      ]);

      return this.createLoginResponse(user, accessToken, refreshToken);
    } catch (err) {
      console.error('Google login error:', err);
      if (err instanceof UnauthorizedException) {
        return errorResponse(err.message, []);
      }
      return errorResponse('Failed to process Google login', []);
    }
  }

  private async verifyGoogleToken(idToken: string) {
    return this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.get('GOOGLE_CLIENT_ID'),
    });
  }

  private async findOrCreateGoogleUser(payload: any): Promise<User> {
    const email = payload.email;
    let user: User | null = await this.userService.findByEmail(email);

    if (!user) {
      const createUserResponse = await this.userService.createNewUser({
        email,
        first_name: payload.given_name,
        last_name: payload.family_name,
        user_name: this.generateUniqueUsername(email),
        password: await hashedPassword(uuidV4()),
        email_verified: coreConstant.IS_VERIFIED,
        login_provider: LOGIN_PROVIDER.GOOGLE,
      });
      console.log(createUserResponse.data, 'here is create user response');

      if (!createUserResponse.success || !createUserResponse.data) {
        throw new Error('Failed to create user');
      }

      user = createUserResponse.data as User;

      // Fetch the newly created user to ensure we have all fields
      const newUser = await this.userService.findByEmail(email);
      if (!newUser) {
        throw new Error('Failed to retrieve newly created user');
      }
      return newUser;
    } else if (user.login_provider !== LOGIN_PROVIDER.GOOGLE) {
      throw new UnauthorizedException(
        'Email already exists with a different login method',
      );
    }

    return user;
  }

  private generateUniqueUsername(email: string): string {
    return `${email.split('@')[0]}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private createLoginResponse(
    user: User,
    accessToken: string,
    refreshToken: string,
  ): ResponseModel {
    return successResponse('Login successful', {
      accessToken,
      refreshToken,
      user,
      isAdmin: user.role === coreConstant.USER_ROLE_ADMIN,
    });
  }

  async linkedinLogin(
    linkedinLoginDto: LinkedInLoginDto,
  ): Promise<ResponseModel> {
    try {
      const { code, state } = linkedinLoginDto;

      // Exchange authorization code for access token
      const tokenResponse = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.configService.get('LINKEDIN_LOGIN_REDIRECT_URI'),
          client_id: this.configService.get('LINKEDIN_CLIENT_ID'),
          client_secret: this.configService.get('LINKEDIN_CLIENT_SECRET'),
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const accessToken = tokenResponse.data.access_token;

      // Get user profile information using LinkedIn v2 API
      const profileResponse = await axios.get(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const profile = profileResponse.data;
      console.log('=== LinkedIn Profile Data ===');
      console.log('Profile:', profile);

      // Extract user information from profile
      const userData = {
        email: profile.email,
        firstName: profile.given_name,
        lastName: profile.family_name,
        linkedinId: profile.sub,
        accessToken,
        photo: profile.picture,
      };

      const user = await this.findOrCreateLinkedInUser(userData);

      // Update user's photo if available from LinkedIn
      if (profile.picture && (!user.photo || user.photo !== profile.picture)) {
        console.log('Updating user photo with LinkedIn profile picture...');
        await this.prisma.user.update({
          where: { id: user.id },
          data: { photo: profile.picture },
        });
      }

      // Check if this LinkedIn profile is already connected to any user
      const existingProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          profileId: profile.sub,
        },
      });

      let linkedInProfile;
      if (existingProfile) {
        // If profile exists, fetch the associated user separately
        const associatedUser = await this.prisma.user.findUnique({
          where: { id: existingProfile.userId },
          select: { id: true, email: true },
        });

        // Check if it's connected to a different user
        if (associatedUser && existingProfile.userId !== user.id) {
          return errorResponse(
            `This LinkedIn profile is already connected to another account (${associatedUser.email}). Please disconnect it first before connecting to a new account.`,
          );
        }

        // If connected to same user or no associated user found, update the token
        linkedInProfile = await this.prisma.linkedInProfile.update({
          where: {
            profileId: profile.sub,
          },
          data: {
            userId: user.id, // Ensure correct user association
            accessToken: accessToken,
            tokenExpiringAt: new Date(
              Date.now() + tokenResponse.data.expires_in * 1000,
            ),
            name: `${profile.given_name} ${profile.family_name}`,
            email: profile.email,
            avatarUrl: profile.picture,
          },
        });
      } else {
        // Create new profile if it doesn't exist
        linkedInProfile = await this.prisma.linkedInProfile.create({
          data: {
            userId: user.id,
            profileId: profile.sub,
            accessToken: accessToken,
            name: `${profile.given_name} ${profile.family_name}`,
            email: profile.email,
            avatarUrl: profile.picture,
            clientId: this.configService.get<string>('LINKEDIN_CLIENT_ID'),
            creatorId: profile.sub,
            tokenExpiringAt: new Date(
              Date.now() + tokenResponse.data.expires_in * 1000,
            ),
            isDefault: true, // First profile is set as default
            timezone: 'UTC',
          },
        });

        // Create default time slots for new profiles with comments explaining the timing strategy
        await this.prisma.postTimeSlot.create({
          data: {
            linkedInProfileId: linkedInProfile.id,
            monday: [
              { time: '08:00', isActive: true }, // Early morning for professionals checking feeds
              { time: '10:30', isActive: true }, // Mid-morning break time
              { time: '17:00', isActive: true }, // End of workday
            ],
            tuesday: [
              { time: '08:00', isActive: true }, // Early morning
              { time: '10:30', isActive: true }, // Mid-morning
              { time: '17:00', isActive: true }, // End of workday
            ],
            wednesday: [
              { time: '08:00', isActive: true }, // Early morning
              { time: '10:30', isActive: true }, // Mid-morning
              { time: '17:00', isActive: true }, // End of workday
            ],
            thursday: [
              { time: '08:00', isActive: true }, // Early morning
              { time: '10:30', isActive: true }, // Mid-morning
              { time: '17:00', isActive: true }, // End of workday
            ],
            friday: [
              { time: '08:00', isActive: true }, // Early morning
              { time: '10:30', isActive: true }, // Mid-morning
              { time: '15:00', isActive: true }, // Earlier on Fridays as engagement drops later
            ],
            saturday: [
              { time: '11:00', isActive: true }, // Later start on weekends
              { time: '15:00', isActive: true }, // Afternoon engagement
            ],
            sunday: [
              { time: '11:00', isActive: true }, // Later start on weekends
              { time: '15:00', isActive: true }, // Afternoon engagement
            ],
            postsPerDay: 3, // Default to 3 posts per day
            minTimeGap: 150, // 2.5 hours minimum gap to avoid oversaturation
          },
        });
      }

      // Fetch updated user data with new photo
      const updatedUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      const data = { sub: user.id, email: user.email };
      const jwtAccessToken = await this.generateAccessToken(data);
      const refreshToken = await this.createRefreshToken({
        sub: data.sub,
        email: data.email,
      });

      // Check for existing subscription
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      // Create trial if no subscription exists
      if (!subscription) {
        await this.subscriptionService.createTrialSubscription(user.id);
      }

      const responseData = {
        accessToken: jwtAccessToken,
        refreshToken,
        user: updatedUser, // Use updated user data with new photo
        linkedInProfile,
        isAdmin: updatedUser.role === coreConstant.USER_ROLE_ADMIN,
        subscription: await this.prisma.subscription.findUnique({
          where: { userId: user.id },
          include: {
            package: true,
          },
        }),
      };

      console.log('=== LinkedIn Login Completed Successfully ===');
      console.log('User Photo Updated:', updatedUser.photo);
      return successResponse('LinkedIn login successful', responseData);
    } catch (error) {
      console.log('=== LinkedIn Login Error ===');
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      console.log('Response data:', error.response?.data);
      console.log('Response status:', error.response?.status);
      console.log('Response headers:', error.response?.headers);
      console.log('=== End Error Log ===');

      return errorResponse(`LinkedIn login failed: ${error.message}`);
    }
  }

  async findOrCreateLinkedInUser(linkedinUser: {
    email: string;
    firstName: string;
    lastName: string;
    linkedinId: string;
    accessToken: string;
    photo?: string;
  }): Promise<User> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: linkedinUser.email },
          { linkedin_id: linkedinUser.linkedinId },
        ],
      },
    });

    if (existingUser) {
      // Update LinkedIn info if needed
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          linkedin_id: linkedinUser.linkedinId,
          linkedin_access_token: linkedinUser.accessToken,
          photo: linkedinUser.photo || existingUser.photo,
        },
      });
      return existingUser;
    }

    // Create new user
    const newUser = await this.prisma.user.create({
      data: {
        email: linkedinUser.email,
        first_name: linkedinUser.firstName,
        last_name: linkedinUser.lastName,
        user_name: this.generateUniqueUsername(linkedinUser.email),
        password: '', // No password for social login
        email_verified: coreConstant.IS_VERIFIED,
        status: coreConstant.STATUS_ACTIVE, // Set user as active
        login_provider: LOGIN_PROVIDER.LINKEDIN,
        linkedin_id: linkedinUser.linkedinId,
        linkedin_access_token: linkedinUser.accessToken,
        photo: linkedinUser.photo,
      },
    });

    return newUser;
  }
}
