import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { ResponseModel } from 'src/shared/models/response.model';
import { isValidTimeZone } from 'src/shared/utils/timezone.util';
import {
  LinkedInPostResponse,
  LinkedInPostError,
  LinkedInPostPayload,
  LinkedInMediaAsset,
  LinkedInMediaUploadResponse,
} from './types/linkedin-post.types';

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);
  private readonly baseUrl = 'https://api.linkedin.com/rest';
  private readonly apiVersion = '202401';
  private stateMap = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getAuthorizationUrl(userId: string): Promise<ResponseModel> {
    try {
      const clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
      const redirectUri = this.configService.get<string>(
        'LINKEDIN_REDIRECT_URI',
      );
      const state = Math.random().toString(36).substring(7);

      // Store state with userId
      this.stateMap.set(state, userId);
      console.log(`Generated state for userId ${userId}:`, state);

      // Using the exact scopes from your OAuth 2.0 settings
      const scope = [
        'openid', // Use your name and photo
        'profile', // Use your name and photo
        'w_member_social', // Create, modify, and delete posts
        'email', // Use primary email address
      ].join(' ');

      const url =
        `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `scope=${encodeURIComponent(scope)}`;

      return successResponse('Authorization URL generated successfully', {
        url,
        state,
      });
    } catch (error) {
      return errorResponse(
        `Failed to generate authorization URL: ${error.message}`,
      );
    }
  }

  async handleOAuthCallback(
    code: string,
    state: string,
    timezone: string = 'UTC',
  ): Promise<ResponseModel> {
    try {
      // Validate timezone
      if (!isValidTimeZone(timezone)) {
        return errorResponse('Invalid timezone format');
      }

      // Get userId from state map
      const userId = this.stateMap.get(state);
      if (!userId) {
        return errorResponse('Invalid state parameter');
      }

      // Get access token
      const tokenData = await this.getAccessToken(code);

      // Get user profile
      const profile = await this.getUserProfile(tokenData.access_token);

      // Check if this LinkedIn profile is already connected to any user
      const existingProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          profileId: profile.sub,
        },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      let linkedInProfile;
      if (existingProfile) {
        // Check if it's connected to a different user
        if (existingProfile.userId !== userId.toString()) {
          return errorResponse(
            `This LinkedIn profile is already connected to another account (${existingProfile.user.email}). Please disconnect it first before connecting to a new account.`,
          );
        }

        // If connected to same user, update the token and timezone
        linkedInProfile = await this.prisma.linkedInProfile.update({
          where: {
            profileId: profile.sub,
          },
          data: {
            accessToken: tokenData.access_token,
            tokenExpiringAt: new Date(Date.now() + tokenData.expires_in * 1000),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.picture,
            timezone,
          },
        });
      } else {
        // Create new profile if it doesn't exist
        linkedInProfile = await this.prisma.linkedInProfile.create({
          data: {
            userId,
            profileId: profile.sub,
            accessToken: tokenData.access_token,
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.picture,
            clientId: this.configService.get<string>('LINKEDIN_CLIENT_ID'),
            creatorId: profile.sub,
            tokenExpiringAt: new Date(Date.now() + tokenData.expires_in * 1000),
            isDefault: true, // First profile is set as default
            timezone,
          },
        });

        // Create default time slots for new profiles
        await this.prisma.postTimeSlot.create({
          data: {
            linkedInProfileId: linkedInProfile.id,
            monday: [
              { time: '08:00', isActive: true }, // Early morning for professionals checking feeds
              { time: '10:30', isActive: true }, // Mid-morning break time
              { time: '17:00', isActive: true }, // End of workday
            ],
            tuesday: [
              { time: '08:00', isActive: true },
              { time: '10:30', isActive: true },
              { time: '17:00', isActive: true },
            ],
            wednesday: [
              { time: '08:00', isActive: true },
              { time: '10:30', isActive: true },
              { time: '17:00', isActive: true },
            ],
            thursday: [
              { time: '08:00', isActive: true },
              { time: '10:30', isActive: true },
              { time: '17:00', isActive: true },
            ],
            friday: [
              { time: '08:00', isActive: true },
              { time: '10:30', isActive: true },
              { time: '15:00', isActive: true }, // Earlier on Fridays as engagement drops later
            ],
            saturday: [
              { time: '11:00', isActive: true }, // Later start on weekends
              { time: '15:00', isActive: true },
            ],
            sunday: [
              { time: '11:00', isActive: true }, // Later start on weekends
              { time: '15:00', isActive: true },
            ],
            postsPerDay: 3,
            minTimeGap: 150, // 2.5 hours minimum gap to avoid oversaturation
          },
        });
      }

      console.log('=== OAuth Callback Completed Successfully ===');

      return successResponse('LinkedIn profile connected successfully', {
        profile: linkedInProfile,
      });
    } catch (error) {
      console.log('=== OAuth Callback Error ===');
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      console.log('Response data:', error.response?.data);
      console.log('Response status:', error.response?.status);
      console.log('Response headers:', error.response?.headers);
      console.log('=== End Error Log ===');

      return errorResponse(`Failed to handle OAuth callback: ${error.message}`);
    }
  }

  private async getAccessToken(code: string): Promise<any> {
    try {
      const clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'LINKEDIN_CLIENT_SECRET',
      );
      const redirectUri = this.configService.get<string>(
        'LINKEDIN_REDIRECT_URI',
      );

      this.logger.debug('Token exchange parameters:', {
        clientId,
        redirectUri,
        codeLength: code.length,
      });

      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('code', code.trim());
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);
      formData.append('redirect_uri', redirectUri);

      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.debug('Token exchange successful');
      return response.data;
    } catch (error) {
      this.logger.error('Token exchange error:', {
        error: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      throw new Error(
        `Token exchange failed: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  private async getUserProfile(accessToken: string): Promise<any> {
    try {
      console.log(
        'Getting user profile with token:',
        accessToken.substring(0, 10) + '...',
      );

      // Only use the OpenID userinfo endpoint
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('User profile data received:', {
        sub: response.data.sub,
        name: response.data.name,
        email: response.data.email,
        picture: response.data.picture,
      });

      return response.data;
    } catch (error) {
      console.log('Error getting user profile:', {
        error: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      throw new Error(
        `Failed to get user profile: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getUserLinkedInProfile(userId: string): Promise<ResponseModel> {
    try {
      const profile = await this.prisma.linkedInProfile.findFirst({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          profileId: true,
          name: true,
          avatarUrl: true,
          linkedInProfileUrl: true,
          tokenExpiringAt: true,
          isDefault: true,
          contentTopics: true,
          professionalIdentity: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!profile) {
        return successResponse('No LinkedIn profile found', { profile: null });
      }

      // Check for expired tokens
      const now = new Date();
      const activeProfile = {
        ...profile,
        isTokenExpired: profile.tokenExpiringAt < now,
      };

      return successResponse('LinkedIn profile retrieved successfully', {
        profile: activeProfile,
      });
    } catch (error) {
      this.logger.error('Error getting LinkedIn profile:', error);
      return errorResponse(`Failed to get LinkedIn profile: ${error.message}`);
    }
  }

  // Optional: Add method to check if a profile's token is expired
  async isTokenExpired(profileId: string): Promise<boolean> {
    try {
      const profile = await this.prisma.linkedInProfile.findUnique({
        where: { profileId },
        select: { tokenExpiringAt: true },
      });

      if (!profile) {
        return true;
      }

      return profile.tokenExpiringAt < new Date();
    } catch (error) {
      this.logger.error('Error checking token expiration:', error);
      return true;
    }
  }

  // Optional: Add method to refresh token if needed
  async refreshToken(profileId: string): Promise<ResponseModel> {
    try {
      const profile = await this.prisma.linkedInProfile.findUnique({
        where: { profileId },
      });

      if (!profile) {
        return errorResponse('Profile not found');
      }

      // LinkedIn doesn't support refresh tokens for basic profile scope
      // For now, we'll just return a message to re-authenticate
      return errorResponse(
        'Token expired. Please reconnect your LinkedIn account',
      );
    } catch (error) {
      this.logger.error('Error refreshing token:', error);
      return errorResponse(`Failed to refresh token: ${error.message}`);
    }
  }
  async disconnectLinkedInProfile(
    userId: string,
    id: string,
  ): Promise<ResponseModel> {
    try {
      // First check if the profile exists and belongs to the user
      const profile = await this.prisma.linkedInProfile.findFirst({
        where: {
          AND: [{ id: id }, { userId }],
        },
      });

      if (!profile) {
        return errorResponse(
          'LinkedIn profile not found or does not belong to this user',
        );
      }

      // Use a transaction to handle all related deletions
      const deletedProfile = await this.prisma.$transaction(async (prisma) => {
        // First, find all LinkedIn posts for this profile
        const posts = await prisma.linkedInPost.findMany({
          where: {
            linkedInProfileId: id,
          },
          select: {
            id: true,
          },
        });

        // Delete QueuedPosts first (due to the required relation)
        await prisma.queuedPost.deleteMany({
          where: {
            linkedInProfileId: id,
          },
        });

        // Delete post logs
        await prisma.postLog.deleteMany({
          where: {
            linkedInPostId: {
              in: posts.map((post) => post.id),
            },
          },
        });

        // Delete post images
        await prisma.linkedInPostImage.deleteMany({
          where: {
            postId: {
              in: posts.map((post) => post.id),
            },
          },
        });

        // Delete time slots
        await prisma.postTimeSlot.deleteMany({
          where: {
            linkedInProfileId: id,
          },
        });

        // Then delete all LinkedIn posts
        await prisma.linkedInPost.deleteMany({
          where: {
            linkedInProfileId: id,
          },
        });

        // Finally delete the profile
        return await prisma.linkedInProfile.delete({
          where: {
            id: id,
          },
        });
      });

      console.log('LinkedIn profile disconnected:', {
        profileId: deletedProfile.profileId,
        userId: deletedProfile.userId,
      });

      return successResponse('LinkedIn profile disconnected successfully', {
        profile: deletedProfile,
      });
    } catch (error) {
      console.log('Error disconnecting LinkedIn profile:', {
        error: error.message,
        userId,
        id,
      });

      return errorResponse(
        `Failed to disconnect LinkedIn profile: ${error.message}`,
      );
    }
  }

  async setDefaultProfile(
    userId: string,
    profileId: string,
  ): Promise<ResponseModel> {
    try {
      const profile = await this.prisma.linkedInProfile.findFirst({
        where: {
          AND: [{ id: profileId }, { userId }],
        },
      });

      if (!profile) {
        return errorResponse(
          'LinkedIn profile not found or does not belong to this user',
        );
      }

      // Use a transaction to ensure data consistency
      await this.prisma.$transaction(async (prisma) => {
        // First, set all profiles for this user to non-default
        await prisma.linkedInProfile.updateMany({
          where: {
            userId,
          },
          data: {
            isDefault: false,
          },
        });

        // Then set the selected profile as default
        await prisma.linkedInProfile.update({
          where: {
            id: profileId,
          },
          data: {
            isDefault: true,
          },
        });
      });

      // Get the updated profile
      const updatedProfile = await this.prisma.linkedInProfile.findUnique({
        where: {
          id: profileId,
        },
        select: {
          id: true,
          profileId: true,
          name: true,
          email: true,
          avatarUrl: true,
          isDefault: true,
          linkedInProfileUrl: true,
          tokenExpiringAt: true,
        },
      });

      console.log('LinkedIn profile set as default:', {
        profileId: updatedProfile.profileId,
        userId,
        isDefault: updatedProfile.isDefault,
      });

      return successResponse('LinkedIn profile set as default successfully', {
        profile: updatedProfile,
      });
    } catch (error) {
      console.log('Error setting LinkedIn profile as default:', {
        error: error.message,
        userId,
        profileId,
      });

      return errorResponse(
        `Failed to set LinkedIn profile as default: ${error.message}`,
      );
    }
  }

  async createLinkedInPost(
    profileId: string,
    postData: {
      content: string;
      imageUrls?: string[];
      videoUrl?: string;
      documentUrl?: string;
    },
  ): Promise<LinkedInPostResponse> {
    try {
      console.log('=== Starting LinkedIn Post Creation ===');
      console.log('Raw Post Data:', postData);

      const profile = await this.prisma.linkedInProfile.findUnique({
        where: { profileId },
      });

      if (!profile) {
        throw new Error('LinkedIn profile not found');
      }

      console.log('Found LinkedIn Profile:', {
        profileId: profile.profileId,
        creatorId: profile.creatorId,
      });

      if (await this.isTokenExpired(profileId)) {
        throw new Error(
          'LinkedIn token has expired. Please reconnect your account.',
        );
      }

      const author = `urn:li:person:${profile.creatorId}`;
      let mediaAssets: LinkedInMediaAsset[] = [];

      // Process images if present
      if (postData.imageUrls?.length > 0) {
        console.log('Processing images...');
        mediaAssets = await this.processImages(postData.imageUrls, profile.accessToken, author);
      }

      // Process video if present
      if (postData.videoUrl) {
        console.log('Processing video...');
        const videoAsset = await this.processVideo(postData.videoUrl, profile.accessToken, author);
        mediaAssets.push(videoAsset);
      }

      // Process document if present
      if (postData.documentUrl) {
        console.log('Processing document...');
        const documentAsset = await this.processDocument(postData.documentUrl, profile.accessToken, author);
        mediaAssets.push(documentAsset);
      }

      // Prepare the post payload using new Posts API format
      const postPayload: LinkedInPostPayload = {
        author,
        commentary: postData.content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      // Add media content if present
      if (mediaAssets.length > 0) {
        postPayload.content = {
          text: '',
          media: mediaAssets,
        };
      }

      console.log('Prepared post payload:', JSON.stringify(postPayload, null, 2));

      // Make the API call to LinkedIn using the new Posts API endpoint
      console.log('Making API call to LinkedIn...');
      const response = await axios.post<LinkedInPostResponse>(
        `${this.baseUrl}/posts`,
        postPayload,
        {
          headers: {
            Authorization: `Bearer ${profile.accessToken}`,
            'LinkedIn-Version': this.apiVersion,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('LinkedIn API Response:', response.data);

      return {
        id: response.data.id,
        author: response.data.author,
        createdAt: response.data.createdAt,
        lastModifiedAt: response.data.lastModifiedAt,
        lifecycleState: response.data.lifecycleState,
        visibility: response.data.visibility,
      };
    } catch (error) {
      console.error('=== LinkedIn Post Creation Error ===');
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Stack trace:', error.stack);
      this.logger.error('Error creating LinkedIn post:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  private async processImages(
    imageUrls: string[],
    accessToken: string,
    owner: string,
  ): Promise<LinkedInMediaAsset[]> {
    console.log('=== Starting Image Processing ===');
    const mediaAssets: LinkedInMediaAsset[] = [];

    for (const [index, imageUrl] of imageUrls.entries()) {
      console.log(`Processing image ${index + 1}/${imageUrls.length}:`, imageUrl);

      try {
        // Register upload using new media asset API
        const registerResponse = await this.registerMediaUpload(
          accessToken,
          owner,
          'IMAGE',
        );

        // Upload image
        await this.uploadMediaToLinkedIn(
          registerResponse.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
          imageUrl,
          accessToken,
        );

        // Create media asset
        const mediaAsset: LinkedInMediaAsset = {
          id: registerResponse.value.asset,
          type: 'IMAGE',
          altText: `Image ${index + 1}`,
        };

        mediaAssets.push(mediaAsset);
        console.log('Media asset added:', mediaAsset);
      } catch (error) {
        console.error(`Error processing image ${index + 1}:`, error);
        throw error;
      }
    }

    return mediaAssets;
  }

  private async registerMediaUpload(
    accessToken: string,
    owner: string,
    type: 'IMAGE' | 'VIDEO' | 'DOCUMENT',
  ): Promise<LinkedInMediaUploadResponse> {
    console.log('=== Starting Media Registration ===');
    console.log('Owner:', owner);
    console.log('Type:', type);

    const recipes = {
      IMAGE: ['urn:li:digitalmediaRecipe:feedshare-image'],
      VIDEO: ['urn:li:digitalmediaRecipe:feedshare-video'],
      DOCUMENT: ['urn:li:digitalmediaRecipe:feedshare-document'],
    };

    try {
      const response = await axios.post<LinkedInMediaUploadResponse>(
        `${this.baseUrl}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: recipes[type],
            owner,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'LinkedIn-Version': this.apiVersion,
          },
        },
      );

      console.log('Registration response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Registration error:', error.response?.data || error);
      throw error;
    }
  }

  private async uploadMediaToLinkedIn(
    uploadUrl: string,
    mediaUrl: string,
    accessToken: string,
  ): Promise<void> {
    console.log('=== Starting Media Upload ===');
    console.log('Upload URL:', uploadUrl);
    console.log('Media URL:', mediaUrl);

    try {
      // Download media from URL
      console.log('Downloading media...');
      const mediaResponse = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(mediaResponse.data);
      console.log('Media downloaded, size:', buffer.length, 'bytes');

      // Upload to LinkedIn
      console.log('Uploading to LinkedIn...');
      const uploadResponse = await axios.put(uploadUrl, buffer, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length,
        },
      });
      console.log('Upload response status:', uploadResponse.status);
    } catch (error) {
      console.error('Upload error:', error.response?.data || error);
      throw error;
    }
  }

  private async processVideo(
    videoUrl: string,
    accessToken: string,
    owner: string,
  ): Promise<LinkedInMediaAsset> {
    console.log('=== Starting Video Processing ===');
    
    try {
      const registerResponse = await this.registerMediaUpload(
        accessToken,
        owner,
        'VIDEO',
      );

      await this.uploadMediaToLinkedIn(
        registerResponse.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
        videoUrl,
        accessToken,
      );

      return {
        id: registerResponse.value.asset,
        type: 'VIDEO',
      };
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  }

  private async processDocument(
    documentUrl: string,
    accessToken: string,
    owner: string,
  ): Promise<LinkedInMediaAsset> {
    console.log('=== Starting Document Processing ===');
    
    try {
      const registerResponse = await this.registerMediaUpload(
        accessToken,
        owner,
        'DOCUMENT',
      );

      await this.uploadMediaToLinkedIn(
        registerResponse.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
        documentUrl,
        accessToken,
      );

      return {
        id: registerResponse.value.asset,
        type: 'DOCUMENT',
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  async updateProfileTimezone(
    userId: string,
    timezone: string,
  ): Promise<ResponseModel> {
    try {
      // Validate timezone
      if (!isValidTimeZone(timezone)) {
        return errorResponse('Invalid timezone format');
      }

      // Find user's LinkedIn profile
      const profile = await this.prisma.linkedInProfile.findFirst({
        where: { userId },
      });

      if (!profile) {
        return errorResponse('No LinkedIn profile found for this user');
      }

      // Update timezone
      const updatedProfile = await this.prisma.linkedInProfile.update({
        where: { id: profile.id },
        data: { timezone },
        select: {
          id: true,
          profileId: true,
          name: true,
          timezone: true,
          avatarUrl: true,
          linkedInProfileUrl: true,
          isDefault: true,
        },
      });

      return successResponse('Timezone updated successfully', {
        profile: updatedProfile,
      });
    } catch (error) {
      this.logger.error('Error updating timezone:', error);
      return errorResponse(`Failed to update timezone: ${error.message}`);
    }
  }
}
