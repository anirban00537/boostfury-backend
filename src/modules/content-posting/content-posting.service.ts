import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrUpdateDraftPostDto } from './dto/create-draft-post.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { User } from '@prisma/client';
import {
  paginatedQuery,
  PaginationOptions,
} from 'src/shared/utils/pagination.util';
import { GetPostsQueryDto } from './dto/get-posts.query.dto';
import { LinkedInService } from '../linkedin/linkedin.service';
import { isValidTimeZone } from 'src/shared/utils/timezone.util';
import { validateLinkedInImage } from 'src/shared/utils/image-validation.util';

@Injectable()
export class ContentPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linkedInService: LinkedInService,
  ) {}

  async getPosts(
    userInfo: User,
    query: GetPostsQueryDto,
  ): Promise<ResponseModel> {
    try {
      const { page = 1, pageSize = 10, workspace_id, status } = query;

      // Build where clause
      const where: any = {
        userId: userInfo.id,
        status:
          status === coreConstant.POST_STATUS.DRAFT
            ? coreConstant.POST_STATUS.DRAFT
            : status === coreConstant.POST_STATUS.SCHEDULED
              ? coreConstant.POST_STATUS.SCHEDULED
              : status === coreConstant.POST_STATUS.PUBLISHED
                ? coreConstant.POST_STATUS.PUBLISHED
                : coreConstant.POST_STATUS.FAILED,
      };

      // Add optional filters
      if (workspace_id) {
        where.workspaceId = workspace_id;
      }

      // Define pagination options
      const paginationOptions: PaginationOptions = {
        page: Number(page),
        pageSize: Number(pageSize),
        orderBy: {
          createdAt: 'desc',
        },
      };

      // Define include relations
      const include = {
        workspace: true,
        linkedInProfile: true,
        postLogs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            user_name: true,
            photo: true,
          },
        },
      };

      // Get paginated results
      const result = await paginatedQuery(
        this.prisma,
        'linkedInPost',
        where,
        paginationOptions,
        include,
      );

      // Add status label to each post
      const postsWithStatusLabel = result.items.map((post: any) => ({
        ...post,
        statusLabel: this.getStatusLabel(post.status),
      }));

      return successResponse('Posts fetched successfully', {
        posts: postsWithStatusLabel,
        pagination: result.pagination,
      });
    } catch (error) {
      return errorResponse(`Failed to fetch posts: ${error.message}`);
    }
  }

  // Helper method to get status label
  private getStatusLabel(status: number): string {
    switch (status) {
      case coreConstant.POST_STATUS.DRAFT:
        return 'Draft';
      case coreConstant.POST_STATUS.SCHEDULED:
        return 'Scheduled';
      case coreConstant.POST_STATUS.PUBLISHED:
        return 'Published';
      case coreConstant.POST_STATUS.FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  async getDraftPost(userId: string, postId: string): Promise<ResponseModel> {
    try {
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
          status: coreConstant.POST_STATUS.DRAFT,
        },
        include: {
          workspace: true,
          linkedInProfile: true,
          postLogs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              user_name: true,
              photo: true,
            },
          },
        },
      });

      if (!post) {
        return errorResponse('Draft post not found');
      }

      return successResponse('Draft post fetched successfully', { post });
    } catch (error) {
      return errorResponse(`Failed to fetch draft post: ${error.message}`);
    }
  }

  async createOrUpdateDraftPost(
    userId: string,
    createOrUpdateDraftPostDto: CreateOrUpdateDraftPostDto,
  ): Promise<ResponseModel> {
    try {
      // Validate post type
      if (
        !Object.values(coreConstant.POST_TYPE).includes(
          createOrUpdateDraftPostDto.postType,
        )
      ) {
        return errorResponse('Invalid post type');
      }
      console.log('createOrUpdateDraftPostDto', createOrUpdateDraftPostDto);

      // Validate limits based on post type
      if (
        createOrUpdateDraftPostDto.hashtags?.length >
        coreConstant.POST_LIMITS.MAX_HASHTAGS
      ) {
        return errorResponse(
          `Maximum ${coreConstant.POST_LIMITS.MAX_HASHTAGS} hashtags allowed`,
        );
      }

      if (
        createOrUpdateDraftPostDto.mentions?.length >
        coreConstant.POST_LIMITS.MAX_MENTIONS
      ) {
        return errorResponse(
          `Maximum ${coreConstant.POST_LIMITS.MAX_MENTIONS} mentions allowed`,
        );
      }

      if (
        createOrUpdateDraftPostDto.imageUrls?.length >
        coreConstant.POST_LIMITS.MAX_IMAGES
      ) {
        return errorResponse(
          `Maximum ${coreConstant.POST_LIMITS.MAX_IMAGES} images allowed`,
        );
      }

      // Verify workspace exists and belongs to user
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          id: createOrUpdateDraftPostDto.workspaceId,
          userId: userId,
        },
      });

      if (!workspace) {
        return errorResponse('Workspace not found');
      }

      // Verify LinkedIn profile exists and belongs to user
      if (createOrUpdateDraftPostDto.linkedInProfileId) {
        const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
          where: {
            id: createOrUpdateDraftPostDto.linkedInProfileId,
            userId: userId,
          },
        });

        if (!linkedInProfile) {
          return errorResponse('LinkedIn profile not found');
        }
      }

      const postData = {
        content: createOrUpdateDraftPostDto.content,
        postType: createOrUpdateDraftPostDto.postType,
        imageUrls: createOrUpdateDraftPostDto.imageUrls || [],
        videoUrl: createOrUpdateDraftPostDto.videoUrl,
        documentUrl: createOrUpdateDraftPostDto.documentUrl,
        hashtags: createOrUpdateDraftPostDto.hashtags || [],
        mentions: createOrUpdateDraftPostDto.mentions || [],
        carouselTitle: createOrUpdateDraftPostDto.carouselTitle,
        videoTitle: createOrUpdateDraftPostDto.videoTitle,
        status: coreConstant.POST_STATUS.DRAFT,
        userId,
        workspaceId: createOrUpdateDraftPostDto.workspaceId,
        linkedInProfileId: createOrUpdateDraftPostDto.linkedInProfileId,
      };

      let draftPost;
      let logMessage;
      let logStatus;

      if (createOrUpdateDraftPostDto.id) {
        const existingPost = await this.prisma.linkedInPost.findFirst({
          where: {
            id: createOrUpdateDraftPostDto.id,
            userId,
            status: coreConstant.POST_STATUS.DRAFT,
          },
        });

        if (!existingPost) {
          return errorResponse('Draft post not found');
        }

        draftPost = await this.prisma.linkedInPost.update({
          where: { id: createOrUpdateDraftPostDto.id },
          data: postData,
          include: {
            workspace: true,
            linkedInProfile: true,
            postLogs: true,
          },
        });
        console.log('draftPost', draftPost);

        logMessage = 'Post draft updated successfully';
        logStatus = coreConstant.POST_LOG_STATUS.DRAFT_UPDATED;
      } else {
        draftPost = await this.prisma.linkedInPost.create({
          data: postData,
          include: {
            workspace: true,
            linkedInProfile: true,
            postLogs: true,
          },
        });

        logMessage = 'Post draft created successfully';
        logStatus = coreConstant.POST_LOG_STATUS.DRAFT_CREATED;
      }

      await this.prisma.postLog.create({
        data: {
          linkedInPostId: draftPost.id,
          status: logStatus,
          message: logMessage,
        },
      });

      return successResponse(logMessage, {
        post: draftPost,
      });
    } catch (error) {
      return errorResponse(
        `Failed to ${createOrUpdateDraftPostDto.id ? 'update' : 'create'} draft post: ${error.message}`,
      );
    }
  }

  async postNow(userId: string, postId: string): Promise<ResponseModel> {
    try {
      const post = await this.prisma.linkedInPost.findUnique({
        where: {
          id: postId,
          userId,
          status: {
            in: [
              coreConstant.POST_STATUS.DRAFT,
              coreConstant.POST_STATUS.SCHEDULED,
            ],
          },
        },
        include: {
          linkedInProfile: true,
        },
      });

      if (!post) {
        return errorResponse('Post not found');
      }

      // Content validation
      if (!post.content?.trim()) {
        return errorResponse('Post content cannot be empty');
      }

      if (post.content.length > coreConstant.LINKEDIN.MAX_CONTENT_LENGTH) {
        return errorResponse(
          `Content exceeds LinkedIn's ${coreConstant.LINKEDIN.MAX_CONTENT_LENGTH} character limit`,
        );
      }

      // Image validation
      if (post.imageUrls?.length) {
        if (post.imageUrls.length > coreConstant.LINKEDIN.MAX_IMAGES) {
          return errorResponse(
            `LinkedIn allows maximum of ${coreConstant.LINKEDIN.MAX_IMAGES} images per post`,
          );
        }

        // Validate each image
        console.log('Validating images...');
        const imageValidationPromises = post.imageUrls.map((url) =>
          validateLinkedInImage(url, {
            maxSize: coreConstant.LINKEDIN.MAX_IMAGE_SIZE,
            supportedTypes: coreConstant.LINKEDIN.SUPPORTED_IMAGE_TYPES,
            minDimensions: coreConstant.LINKEDIN.MIN_IMAGE_DIMENSIONS,
            maxDimensions: coreConstant.LINKEDIN.MAX_IMAGE_DIMENSIONS,
            aspectRatio: coreConstant.LINKEDIN.ASPECT_RATIO,
          }),
        );

        const imageValidationResults = await Promise.all(
          imageValidationPromises,
        );
        const invalidImages = imageValidationResults
          .map((result, index) => ({ result, url: post.imageUrls[index] }))
          .filter((item) => !item.result.isValid);

        if (invalidImages.length > 0) {
          const errors = invalidImages
            .map((item) => `Image ${item.url}: ${item.result.error}`)
            .join(', ');
          return errorResponse(`Invalid images found: ${errors}`);
        }
      }

      // Media combination validation
      if (post.videoUrl && post.imageUrls?.length) {
        return errorResponse(
          'Cannot post both video and images simultaneously on LinkedIn',
        );
      }

      if (post.documentUrl && (post.imageUrls?.length || post.videoUrl)) {
        return errorResponse(
          'Cannot post document with images or video on LinkedIn',
        );
      }

      console.log('=== Post Data ===', {
        ...post,
        content: post.content.substring(0, 100) + '...',
        imageCount: post.imageUrls?.length || 0,
        hasVideo: !!post.videoUrl,
        hasDocument: !!post.documentUrl,
      });

      try {
        const linkedInResponse = await this.linkedInService.createLinkedInPost(
          post.linkedInProfile.profileId,
          {
            content: post.content,
            imageUrls: post.imageUrls,
            videoUrl: post.videoUrl,
            documentUrl: post.documentUrl,
          },
        );

        // Update post status and create success log
        const updatedPost = await this.prisma.$transaction(async (prisma) => {
          const updated = await prisma.linkedInPost.update({
            where: { id: post.id },
            data: {
              status: coreConstant.POST_STATUS.PUBLISHED,
              publishedAt: new Date(),
              publishedId: linkedInResponse.postId,
            },
            include: {
              workspace: true,
              linkedInProfile: true,
              postLogs: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
            },
          });

          await prisma.postLog.create({
            data: {
              linkedInPostId: post.id,
              status: coreConstant.POST_LOG_STATUS.PUBLISHED,
              message: `Post published successfully on LinkedIn. Post ID: ${linkedInResponse.postId}`,
              timestamp: new Date(),
            },
          });

          return updated;
        });

        return successResponse('Post published successfully', {
          post: updatedPost,
        });
      } catch (error) {
        // Create failure log
        await this.prisma.postLog.create({
          data: {
            linkedInPostId: post.id,
            status: coreConstant.POST_LOG_STATUS.FAILED,
            message: error.message,
          },
        });

        // Update post status to failed
        await this.prisma.linkedInPost.update({
          where: { id: post.id },
          data: { status: coreConstant.POST_STATUS.FAILED },
        });

        throw error;
      }
    } catch (error) {
      return errorResponse(`Failed to publish post: ${error.message}`);
    }
  }

  async schedulePost(
    userId: string,
    postId: string,
    scheduledTime: string,
    timeZone: string,
  ): Promise<ResponseModel> {
    try {
      // Validate timezone
      if (!isValidTimeZone(timeZone)) {
        return errorResponse('Invalid timezone');
      }

      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
          status: coreConstant.POST_STATUS.DRAFT,
        },
      });

      if (!post) {
        return errorResponse('Draft post not found');
      }
      if (!post.linkedInProfileId) {
        return errorResponse('Select a LinkedIn profile to schedule the post');
      }

      // Convert scheduled time to UTC
      const scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        return errorResponse('Invalid date format');
      }

      // Ensure scheduled time is in the future
      if (scheduledDate <= new Date()) {
        return errorResponse('Scheduled time must be in the future');
      }

      // Update post status and scheduled time
      const updatedPost = await this.prisma.$transaction(async (prisma) => {
        const updated = await prisma.linkedInPost.update({
          where: { id: post.id },
          data: {
            status: coreConstant.POST_STATUS.SCHEDULED,
            scheduledTime: scheduledDate,
          },
          include: {
            workspace: true,
            linkedInProfile: true,
            postLogs: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        });

        await prisma.postLog.create({
          data: {
            linkedInPostId: post.id,
            status: coreConstant.POST_LOG_STATUS.SCHEDULED,
            message: `Post scheduled for ${scheduledTime} ${timeZone}`,
          },
        });

        return updated;
      });

      return successResponse('Post scheduled successfully', {
        post: updatedPost,
      });
    } catch (error) {
      return errorResponse(`Failed to schedule post: ${error.message}`);
    }
  }
  async deletePost(userId: string, postId: string): Promise<ResponseModel> {
    try {
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
        },
      });

      if (!post) {
        return errorResponse('Post not found');
      }
      //search post logs and delete them
      await this.prisma.postLog.deleteMany({
        where: {
          linkedInPostId: postId,
        },
      });

     const deletedPost = await this.prisma.linkedInPost.delete({
        where: {
          id: postId,
        },
      });
      if (!deletedPost) {
        return errorResponse('Post not deleted');
      }
      return successResponse('Post deleted successfully', deletedPost);
    } catch (error) {
      return errorResponse(`Failed to delete post: ${error.message}`);
    }
  }
}
