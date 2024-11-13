import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { ResponseModel } from 'src/shared/models/response.model';
import {
  LinkedInPostResponse,
  LinkedInPostError,
  LinkedInPostMedia,
  LinkedInPostPayload,
} from './types/linkedin-post.types';

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);
  private readonly baseUrl = 'https://api.linkedin.com/v2';
  private readonly apiVersion = '202404';
  private stateMap = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getAuthorizationUrl(userId: number): Promise<ResponseModel> {
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
  ): Promise<ResponseModel> {
    try {
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

      if (existingProfile) {
        // Check if it's connected to a different user
        if (existingProfile.userId !== userId) {
          return errorResponse(
            `This LinkedIn profile is already connected to another account (${existingProfile.user.email}). Please disconnect it first before connecting to a new account.`,
          );
        }

        // If connected to same user, update the token
        const updatedProfile = await this.prisma.linkedInProfile.update({
          where: {
            profileId: profile.sub,
          },
          data: {
            accessToken: tokenData.access_token,
            tokenExpiringAt: new Date(Date.now() + tokenData.expires_in * 1000),
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.picture,
          },
        });

        return successResponse('LinkedIn profile token updated successfully', {
          profile: updatedProfile,
        });
      }

      // Create new profile if it doesn't exist
      const linkedInProfile = await this.prisma.linkedInProfile.create({
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
        },
      });

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

  async getUserLinkedInProfiles(userId: number): Promise<ResponseModel> {
    try {
      const profiles = await this.prisma.linkedInProfile.findMany({
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
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!profiles.length) {
        return successResponse('No LinkedIn profiles found', { profiles: [] });
      }

      // Check for expired tokens
      const now = new Date();
      const activeProfiles = profiles.map((profile) => ({
        ...profile,
        isTokenExpired: profile.tokenExpiringAt < now,
      }));

      return successResponse('LinkedIn profiles retrieved successfully', {
        profiles: activeProfiles,
      });
    } catch (error) {
      this.logger.error('Error getting LinkedIn profiles:', error);
      return errorResponse(`Failed to get LinkedIn profiles: ${error.message}`);
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
    userId: number,
    id: number,
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

      // Then delete the profile
      const deletedProfile = await this.prisma.linkedInProfile.delete({
        where: {
          id: id, // Use the internal ID which is unique
        },
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
    userId: number,
    profileId: number,
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
      console.log('Image URLs type:', typeof postData.imageUrls);
      console.log('Image URLs:', postData.imageUrls);
      console.log('Image URLs length:', postData.imageUrls?.length);

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
      let mediaAssets = [];

      // Enhanced image processing check
      if (
        postData.imageUrls &&
        Array.isArray(postData.imageUrls) &&
        postData.imageUrls.length > 0
      ) {
        console.log('Processing images...');
        console.log('Number of images to process:', postData.imageUrls.length);

        try {
          for (const [index, url] of postData.imageUrls.entries()) {
            console.log(`Processing image ${index + 1}:`, url);

            // Register upload
            console.log('Registering image with LinkedIn...');
            const registerResponse = await this.registerImageUpload(
              profile.accessToken,
              author,
            );
            console.log('Registration response:', registerResponse);

            // Upload image
            console.log('Uploading image to LinkedIn...');
            await this.uploadImageToLinkedIn(
              registerResponse.uploadUrl,
              url,
              profile.accessToken,
            );
            console.log('Image upload completed');

            const mediaAsset: LinkedInPostMedia = {
              status: 'READY' as const,
              description: { text: '' },
              media: registerResponse.asset,
              title: { text: '' },
            };
            mediaAssets.push(mediaAsset);
            console.log('Media asset added:', mediaAsset);
          }
        } catch (error) {
          console.error('Error in image processing:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
          throw new Error(`Image processing failed: ${error.message}`);
        }
      } else {
        console.log('No images to process or invalid image data:', {
          imageUrls: postData.imageUrls,
          isArray: Array.isArray(postData.imageUrls),
          length: postData.imageUrls?.length,
        });
      }

      // Prepare the post payload
      const postPayload: LinkedInPostPayload = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postData.content,
            },
            shareMediaCategory: mediaAssets.length ? 'IMAGE' : 'NONE',
            ...(mediaAssets.length && { media: mediaAssets }),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      console.log(
        'Prepared post payload:',
        JSON.stringify(postPayload, null, 2),
      );

      // Make the API call to LinkedIn
      console.log('Making API call to LinkedIn...');
      const response = await axios.post<LinkedInPostResponse>(
        `${this.baseUrl}/ugcPosts`,
        postPayload,
        {
          headers: {
            Authorization: `Bearer ${profile.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('LinkedIn API Response:', response.data);

      return {
        postId: response.data.postId,
        author: response.data.author,
        created: response.data.created,
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
  ): Promise<LinkedInPostMedia[]> {
    console.log('=== Starting Image Processing ===');
    const mediaAssets: LinkedInPostMedia[] = [];

    for (const [index, imageUrl] of imageUrls.entries()) {
      console.log(
        `Processing image ${index + 1}/${imageUrls.length}:`,
        imageUrl,
      );

      try {
        // Step 1: Register upload
        console.log('Registering image upload with LinkedIn...');
        const registerResponse = await this.registerImageUpload(
          accessToken,
          owner,
        );
        console.log('Register response:', registerResponse);

        // Step 2: Upload image
        console.log('Uploading image to LinkedIn...');
        await this.uploadImageToLinkedIn(
          registerResponse.uploadUrl,
          imageUrl,
          accessToken,
        );
        console.log('Image upload completed');

        // Add to media assets with correct type
        const mediaAsset: LinkedInPostMedia = {
          status: 'READY' as const, // Using const assertion
          description: { text: '' },
          media: registerResponse.asset,
          title: { text: '' },
        };
        console.log('Created media asset:', mediaAsset);
        mediaAssets.push(mediaAsset);
      } catch (error) {
        console.error(`Error processing image ${index + 1}:`, error);
        throw error;
      }
    }

    console.log('=== Image Processing Completed ===');
    console.log('Total media assets:', mediaAssets.length);
    return mediaAssets;
  }

  private async registerImageUpload(accessToken: string, owner: string) {
    console.log('=== Starting Image Registration ===');
    console.log('Owner:', owner);

    try {
      const response = await axios.post(
        `${this.baseUrl}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: owner,
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
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
        },
      );

      console.log('Registration response:', response.data);
      return {
        uploadUrl:
          response.data.value.uploadMechanism[
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
          ].uploadUrl,
        asset: response.data.value.asset,
      };
    } catch (error) {
      console.error('Registration error:', error.response?.data || error);
      throw error;
    }
  }

  private async uploadImageToLinkedIn(
    uploadUrl: string,
    imageUrl: string,
    accessToken: string,
  ) {
    console.log('=== Starting Image Upload ===');
    console.log('Upload URL:', uploadUrl);
    console.log('Image URL:', imageUrl);

    try {
      // Download image from URL
      console.log('Downloading image...');
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(imageResponse.data);
      console.log('Image downloaded, size:', buffer.length, 'bytes');

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
}
