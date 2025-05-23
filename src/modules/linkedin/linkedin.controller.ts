import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  Req,
  Param,
  Delete,
  Patch,
  Body,
} from '@nestjs/common';
import { LinkedInService } from './linkedin.service';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { errorResponse } from 'src/shared/helpers/functions';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';

@ApiTags('LinkedIn')
@Controller('linkedin')
@ApiBearerAuth()
export class LinkedInController {
  constructor(private readonly linkedInService: LinkedInService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get LinkedIn authorization URL' })
  @IsSubscribed()
  async getAuthUrl(@UserInfo() user: User) {
    return this.linkedInService.getAuthorizationUrl(user.id);
  }

  @Get('callback')
  @IsSubscribed()
  @ApiOperation({ summary: 'Handle LinkedIn OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('timezone') timezone: string = 'UTC',
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      return errorResponse(decodeURIComponent(errorDescription));
    }

    if (!code || !state) {
      return errorResponse('Missing required parameters');
    }

    return this.linkedInService.handleOAuthCallback(code, state, timezone);
  }

  @Get('profile')
  async getProfile(@UserInfo() user: User) {
    return this.linkedInService.getUserLinkedInProfile(user.id);
  }

  @Delete('disconnect/:profileId')
  @IsSubscribed()
  async disconnectProfile(
    @UserInfo() user: User,
    @Param('profileId') profileId: string,
  ) {
    return this.linkedInService.disconnectLinkedInProfile(user.id, profileId);
  }

  @Patch('profile/timezone')
  @ApiOperation({ summary: 'Update LinkedIn profile timezone' })
  @IsSubscribed()
  async updateTimezone(
    @UserInfo() user: User,
    @Body('timezone') timezone: string,
  ) {
    return this.linkedInService.updateProfileTimezone(user.id, timezone);
  }
}
