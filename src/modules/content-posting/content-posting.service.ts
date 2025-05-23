import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrUpdateDraftPostDto,
  PostType,
} from './dto/create-draft-post.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { PostTimeSlot, User, Prisma } from '@prisma/client';
import {
  paginatedQuery,
  PaginationOptions,
} from 'src/shared/utils/pagination.util';
import { GetPostsQueryDto } from './dto/get-posts.query.dto';
import { LinkedInService } from '../linkedin/linkedin.service';
import { isValidTimeZone } from 'src/shared/utils/timezone.util';
import { validateLinkedInImage } from 'src/shared/utils/image-validation.util';
import {
  uploadFile,
  deleteFileFromS3,
} from 'src/shared/configs/multer-upload.config';
import { TimeSlotData, TimeSlotGroup } from './dto/time-slot.dto';
import { TimeSlotSettingsDto } from './dto/time-slot-settings.dto';
import { GenerateAndCreateDraftDto } from './dto/generate-and-create-draft.dto';
import { AiContentService } from '../ai-content/ai-content.service';

@Injectable()
export class ContentPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linkedInService: LinkedInService,
    private readonly aiContentService: AiContentService,
  ) {}

  async getPosts(
    userInfo: User,
    query: {
      page?: number;
      pageSize?: number;
      linkedInProfileId?: string;
      status?: number;
    },
  ): Promise<ResponseModel> {
    try {
      const { page = 1, pageSize = 10, linkedInProfileId, status } = query;

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
      if (linkedInProfileId) {
        where.linkedInProfileId = linkedInProfileId;
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

  async getDraftScheduledPost(
    userId: string,
    postId: string,
  ): Promise<ResponseModel> {
    try {
      const post = await this.prisma.linkedInPost.findFirst({
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
          images: true,
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

      // Verify LinkedIn profile exists and belongs to user
      if (!createOrUpdateDraftPostDto.linkedInProfileId) {
        return errorResponse('Connect your LinkedIn profile to start posting');
      }

      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: createOrUpdateDraftPostDto.linkedInProfileId,
          userId: userId,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      const postData = {
        content: createOrUpdateDraftPostDto.content,
        postType: createOrUpdateDraftPostDto.postType,
        videoUrl: createOrUpdateDraftPostDto.videoUrl,
        documentUrl: createOrUpdateDraftPostDto.documentUrl,
        hashtags: createOrUpdateDraftPostDto.hashtags || [],
        mentions: createOrUpdateDraftPostDto.mentions || [],
        carouselTitle: createOrUpdateDraftPostDto.carouselTitle,
        videoTitle: createOrUpdateDraftPostDto.videoTitle,
        status: coreConstant.POST_STATUS.DRAFT,
        userId,
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
            status: {
              in: [
                coreConstant.POST_STATUS.DRAFT,
                coreConstant.POST_STATUS.SCHEDULED,
              ],
            },
          },
        });

        if (!existingPost) {
          return errorResponse('Draft post not found');
        }
        delete postData.status;
        draftPost = await this.prisma.linkedInPost.update({
          where: { id: createOrUpdateDraftPostDto.id },
          data: postData,
          include: {
            linkedInProfile: true,
            postLogs: true,
            images: true,
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
        console.log('draftPost', draftPost);

        logMessage = 'Post draft updated successfully';
        logStatus = coreConstant.POST_LOG_STATUS.DRAFT_UPDATED;
      } else {
        draftPost = await this.prisma.linkedInPost.create({
          data: postData,
          include: {
            linkedInProfile: true,
            postLogs: true,
            images: true,
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
          images: true,
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
      if (post.images?.length) {
        if (post.images.length > coreConstant.LINKEDIN.MAX_IMAGES) {
          return errorResponse(
            `LinkedIn allows maximum of ${coreConstant.LINKEDIN.MAX_IMAGES} images per post`,
          );
        }

        // Validate each image
        console.log('Validating images...');
        const imageValidationPromises = post.images.map((image) =>
          validateLinkedInImage(image.imageUrl, {
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
          .map((result, index) => ({
            result,
            url: post.images[index].imageUrl,
          }))
          .filter((item) => !item.result.isValid);

        if (invalidImages.length > 0) {
          const errors = invalidImages
            .map((item) => `Image ${item.url}: ${item.result.error}`)
            .join(', ');
          return errorResponse(`Invalid images found: ${errors}`);
        }
      }

      // Media combination validation
      if (post.videoUrl && post.images?.length) {
        return errorResponse(
          'Cannot post both video and images simultaneously on LinkedIn',
        );
      }

      if (post.documentUrl && (post.images?.length || post.videoUrl)) {
        return errorResponse(
          'Cannot post document with images or video on LinkedIn',
        );
      }

      console.log('=== Post Data ===', {
        ...post,
        content: post.content.substring(0, 100) + '...',
        imageCount: post.images?.length || 0,
        hasVideo: !!post.videoUrl,
        hasDocument: !!post.documentUrl,
      });

      try {
        const linkedInResponse = await this.linkedInService.createLinkedInPost(
          post.linkedInProfile.profileId,
          {
            content: post.content,
            imageUrls: post.images.map((img) => img.imageUrl),
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
              linkedInProfile: true,
              postLogs: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
              images: true,
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
  async deletePost(userId: string, postId: string): Promise<any> {
    try {
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
        },
        include: {
          images: true, // Include images to delete them from S3
        },
      });
  
      if (!post) {
        return errorResponse('Post not found');
      }
      await this.prisma.$transaction(async (prisma) => {
        await prisma.queuedPost.deleteMany({
          where: {
            postId,
          },
        });
        await prisma.postLog.deleteMany({
          where: {
            linkedInPostId: postId,
          },
        });

        if (post.images && post.images.length > 0) {
          for (const image of post.images) {
            try {
              await deleteFileFromS3(image.imageUrl); // Delete image from S3
            } catch (s3Error) {
              console.error(`Failed to delete image from S3: ${image.imageUrl}`, s3Error);
            }
          }
        }
  
        await prisma.linkedInPostImage.deleteMany({
          where: {
            postId,
          },
        });
        await prisma.linkedInPost.delete({
          where: {
            id: postId,
          },
        });
      });
      return successResponse('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      return errorResponse(`Failed to delete post: ${error.message}`);
    }
  }

  async uploadImage(
    userId: string,
    postId: string,
    file: Express.Multer.File,
  ): Promise<ResponseModel> {
    try {
      // Verify post exists and belongs to user
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
          status: coreConstant.POST_STATUS.DRAFT,
        },
        include: {
          images: true,
        },
      });

      if (!post) {
        return errorResponse('Draft post not found');
      }

      // Check image limit
      if (post.images.length >= coreConstant.LINKEDIN.MAX_IMAGES) {
        return errorResponse(
          `Maximum ${coreConstant.LINKEDIN.MAX_IMAGES} images allowed per post`,
        );
      }

      // Upload image to S3
      const imageUrl = await uploadFile(file, userId);
      if (!imageUrl) {
        return errorResponse('Failed to upload image');
      }

      // Add image to post
      const postImage = await this.prisma.linkedInPostImage.create({
        data: {
          postId: post.id,
          imageUrl,
          order: post.images.length, // Add as last image
        },
      });

      return successResponse('Image uploaded successfully', {
        image: postImage,
      });
    } catch (error) {
      return errorResponse(`Failed to upload image: ${error.message}`);
    }
  }

  async deleteImage(
    userId: string,
    postId: string,
    imageId: string,
  ): Promise<ResponseModel> {
    try {
      // Verify post and image exist and belong to user
      const postImage = await this.prisma.linkedInPostImage.findFirst({
        where: {
          id: imageId,
          postId,
          post: {
            userId,
            status: coreConstant.POST_STATUS.DRAFT,
          },
        },
      });

      if (!postImage) {
        return errorResponse('Image not found');
      }

      // Delete from S3
      await deleteFileFromS3(postImage.imageUrl);

      // Delete from database
      await this.prisma.linkedInPostImage.delete({
        where: { id: imageId },
      });

      // Reorder remaining images
      await this.prisma.linkedInPostImage.updateMany({
        where: {
          postId,
          order: {
            gt: postImage.order,
          },
        },
        data: {
          order: {
            decrement: 1,
          },
        },
      });

      return successResponse('Image deleted successfully');
    } catch (error) {
      return errorResponse(`Failed to delete image: ${error.message}`);
    }
  }

  async reorderImages(
    userId: string,
    postId: string,
    imageIds: string[],
  ): Promise<ResponseModel> {
    try {
      // Verify post exists and belongs to user
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
          status: coreConstant.POST_STATUS.DRAFT,
        },
        include: {
          images: true,
        },
      });

      if (!post) {
        return errorResponse('Draft post not found');
      }

      // Verify all images exist and belong to post
      const validImageIds = new Set(post.images.map((img) => img.id));
      if (!imageIds.every((id) => validImageIds.has(id))) {
        return errorResponse('Invalid image IDs provided');
      }

      // Update order of images
      await this.prisma.$transaction(
        imageIds.map((imageId, index) =>
          this.prisma.linkedInPostImage.update({
            where: { id: imageId },
            data: { order: index },
          }),
        ),
      );

      return successResponse('Images reordered successfully');
    } catch (error) {
      return errorResponse(`Failed to reorder images: ${error.message}`);
    }
  }

  async getScheduledQueue(
    userId: string,
    query: {
      page?: number;
      pageSize?: number;
      linkedInProfileId?: string;
    },
  ): Promise<ResponseModel> {
    try {
      const { page = 1, pageSize = 10, linkedInProfileId } = query;

      // Build where clause for scheduled posts
      const where: any = {
        userId,
        status: coreConstant.POST_STATUS.SCHEDULED,
        scheduledTime: {
          gte: new Date(), // Only future scheduled posts
        },
      };

      if (linkedInProfileId) {
        where.linkedInProfileId = linkedInProfileId;
      }

      // Define pagination options
      const paginationOptions: PaginationOptions = {
        page: Number(page),
        pageSize: Number(pageSize),
        orderBy: {
          scheduledTime: 'asc', // Order by scheduled time ascending
        },
      };

      // Define include relations
      const include = {
        linkedInProfile: true,
        images: {
          orderBy: {
            order: 'asc',
          },
        },
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

      // Add additional information to each post
      const postsWithDetails = result.items.map((post: any) => ({
        ...post,
        statusLabel: this.getStatusLabel(post.status),
        timeUntilPublishing: this.getTimeUntilPublishing(post.scheduledTime),
      }));

      return successResponse('Scheduled queue fetched successfully', {
        posts: postsWithDetails,
        pagination: result.pagination,
      });
    } catch (error) {
      return errorResponse(`Failed to fetch scheduled queue: ${error.message}`);
    }
  }

  // Helper method to calculate time until publishing
  private getTimeUntilPublishing(scheduledTime: Date): string {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diffInMilliseconds = scheduled.getTime() - now.getTime();

    // Convert to various time units
    const minutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} from now`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} from now`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} from now`;
    } else {
      return 'Less than a minute';
    }
  }

  async createAndUpdateTimeSlots(
    userId: string,
    linkedInProfileId: string,
    timeSlotGroups: TimeSlotGroup[],
  ): Promise<ResponseModel> {
    try {
      // Verify LinkedIn profile belongs to user
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      // Validate time format for all slots
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const group of timeSlotGroups) {
        if (!timeRegex.test(group.time)) {
          return errorResponse(
            `Invalid time format: ${group.time}. Use HH:mm format`,
          );
        }
      }

      // Check for duplicate day-time combinations
      const timeSlotSet = new Set();
      for (const group of timeSlotGroups) {
        for (const slot of group.slots.filter((slot) => slot.isActive)) {
          const key = `${slot.dayOfWeek}-${group.time}`;
          if (timeSlotSet.has(key)) {
            return errorResponse(
              `Duplicate time slot found for day ${slot.dayOfWeek} at ${group.time}`,
            );
          }
          timeSlotSet.add(key);
        }
      }

      // Transform data for storage by grouping slots by day
      const groupedByDay = {} as Record<
        number,
        { time: string; isActive: boolean }[]
      >;

      for (const group of timeSlotGroups) {
        for (const slot of group.slots) {
          if (!groupedByDay[slot.dayOfWeek]) {
            groupedByDay[slot.dayOfWeek] = [];
          }
          groupedByDay[slot.dayOfWeek].push({
            time: group.time,
            isActive: slot.isActive,
          });
        }
      }

      // Sort time slots for each day
      for (const day in groupedByDay) {
        groupedByDay[day].sort((a, b) => a.time.localeCompare(b.time));
      }

      // Create the update data
      const updateData = {
        monday: groupedByDay[1] || [],
        tuesday: groupedByDay[2] || [],
        wednesday: groupedByDay[3] || [],
        thursday: groupedByDay[4] || [],
        friday: groupedByDay[5] || [],
        saturday: groupedByDay[6] || [],
        sunday: groupedByDay[0] || [],
      };

      // Upsert the time slots record
      const result = await this.prisma.postTimeSlot.upsert({
        where: {
          linkedInProfileId,
        },
        create: {
          linkedInProfileId,
          ...updateData,
        },
        update: updateData,
      });

      return successResponse('Time slots updated successfully', {
        monday: result.monday,
        tuesday: result.tuesday,
        wednesday: result.wednesday,
        thursday: result.thursday,
        friday: result.friday,
        saturday: result.saturday,
        sunday: result.sunday,
      });
    } catch (error) {
      console.error('Error in createAndUpdateTimeSlots:', error);
      return errorResponse(`Failed to update time slots: ${error.message}`);
    }
  }

  async getTimeSlots(
    userId: string,
    linkedInProfileId: string,
  ): Promise<ResponseModel> {
    try {
      // Verify LinkedIn profile belongs to user
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      const timeSlotRecord = await this.prisma.postTimeSlot.findUnique({
        where: { linkedInProfileId },
      });

      if (!timeSlotRecord) {
        return successResponse('No time slots found', { timeSlots: [] });
      }

      // Convert the daily arrays into a unified format
      const timeSlots = [
        ...this.convertDaySlots(0, timeSlotRecord.sunday),
        ...this.convertDaySlots(1, timeSlotRecord.monday),
        ...this.convertDaySlots(2, timeSlotRecord.tuesday),
        ...this.convertDaySlots(3, timeSlotRecord.wednesday),
        ...this.convertDaySlots(4, timeSlotRecord.thursday),
        ...this.convertDaySlots(5, timeSlotRecord.friday),
        ...this.convertDaySlots(6, timeSlotRecord.saturday),
      ];

      // Group time slots by time
      const groupedSlots = timeSlots.reduce((groups: TimeSlotGroup[], slot) => {
        const existingGroup = groups.find((g) => g.time === slot.time);
        if (existingGroup) {
          existingGroup.slots.push({
            dayOfWeek: slot.dayOfWeek,
            isActive: slot.isActive,
          });
        } else {
          groups.push({
            time: slot.time,
            slots: [
              {
                dayOfWeek: slot.dayOfWeek,
                isActive: slot.isActive,
              },
            ],
          });
        }
        return groups;
      }, []);

      return successResponse('Time slots fetched successfully', {
        timeSlots: groupedSlots,
      });
    } catch (error) {
      return errorResponse(`Failed to fetch time slots: ${error.message}`);
    }
  }

  // Helper method to convert daily slots
  private convertDaySlots(dayOfWeek: number, slots: any[]): TimeSlotData[] {
    return slots.map((slot) => ({
      dayOfWeek,
      time: typeof slot === 'string' ? slot : slot.time,
      isActive: typeof slot === 'string' ? true : (slot.isActive ?? true),
    }));
  }

  async getNextAvailableTimeSlot(
    userId: string,
    linkedInProfileId: string,
    fromDate: Date = new Date(),
  ): Promise<Date | null> {
    try {
      // Verify LinkedIn profile belongs to user
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
      });

      if (!linkedInProfile) {
        return null;
      }

      const timeSlotRecord = await this.prisma.postTimeSlot.findUnique({
        where: { linkedInProfileId },
      });

      if (!timeSlotRecord) {
        return null;
      }

      // Combine all days' time slots into a single array
      const timeSlots: TimeSlotData[] = [
        ...this.convertDaySlots(0, timeSlotRecord.sunday),
        ...this.convertDaySlots(1, timeSlotRecord.monday),
        ...this.convertDaySlots(2, timeSlotRecord.tuesday),
        ...this.convertDaySlots(3, timeSlotRecord.wednesday),
        ...this.convertDaySlots(4, timeSlotRecord.thursday),
        ...this.convertDaySlots(5, timeSlotRecord.friday),
        ...this.convertDaySlots(6, timeSlotRecord.saturday),
      ];

      const activeTimeSlots = timeSlots.filter((slot) => slot.isActive);

      if (activeTimeSlots.length === 0) {
        return null;
      }

      const currentDate = new Date(fromDate);
      const currentDay = currentDate.getDay();
      const currentTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      // Find next available slot
      let daysChecked = 0;
      while (daysChecked < 7) {
        const daySlots = activeTimeSlots.filter(
          (slot) => slot.dayOfWeek === (currentDay + daysChecked) % 7,
        );

        for (const slot of daySlots) {
          if (daysChecked === 0 && slot.time <= currentTime) {
            continue;
          }

          const [hours, minutes] = slot.time.split(':').map(Number);
          const nextDate = new Date(currentDate);
          nextDate.setDate(currentDate.getDate() + daysChecked);
          nextDate.setHours(hours, minutes, 0, 0);

          return nextDate;
        }

        daysChecked++;
      }

      return null;
    } catch (error) {
      console.error('Error getting next available time slot:', error);
      return null;
    }
  }

  async addToQueue(userId: string, postId: string): Promise<ResponseModel> {
    try {
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: postId,
          userId,
          status: coreConstant.POST_STATUS.DRAFT,
        },
        include: { linkedInProfile: true },
      });

      if (!post) {
        return errorResponse('Draft post not found');
      }

      // Get queue settings and current queue
      const timeSlots = await this.prisma.postTimeSlot.findUnique({
        where: { linkedInProfileId: post.linkedInProfileId },
      });

      // Get next available slot
      const nextSlot = await this.calculateNextAvailableSlot(
        post.linkedInProfileId,
        timeSlots,
      );

      if (!nextSlot) {
        return errorResponse('No available time slots found');
      }

      // Add to queue and schedule
      const [queuedPost, updatedPost] = await this.prisma.$transaction([
        this.prisma.queuedPost.create({
          data: {
            linkedInProfileId: post.linkedInProfileId,
            postId: post.id,
            queueOrder: await this.getNextQueueOrder(post.linkedInProfileId),
            scheduledFor: nextSlot,
          },
        }),
        this.prisma.linkedInPost.update({
          where: { id: post.id },
          data: {
            status: coreConstant.POST_STATUS.SCHEDULED,
            scheduledTime: nextSlot,
          },
          include: {
            linkedInProfile: true,
            postLogs: true,
          },
        }),
      ]);

      return successResponse('Post added to queue', {
        queuedPost,
        post: updatedPost,
      });
    } catch (error) {
      return errorResponse(`Failed to add post to queue: ${error.message}`);
    }
  }

  private async calculateNextAvailableSlot(
    linkedInProfileId: string,
    timeSlots: PostTimeSlot,
  ): Promise<Date | null> {
    try {
      const now = new Date();
      console.log('=== Starting calculateNextAvailableSlot ===');
      console.log('Current time:', now);
      console.log('LinkedIn Profile ID:', linkedInProfileId);
      console.log('Time Slots Config:', JSON.stringify(timeSlots, null, 2));

      // Get all scheduled posts for this LinkedIn profile
      const scheduledPosts = await this.prisma.linkedInPost.findMany({
        where: {
          linkedInProfileId,
          status: coreConstant.POST_STATUS.SCHEDULED,
          scheduledTime: {
            gte: now,
          },
        },
        orderBy: {
          scheduledTime: 'asc',
        },
      });

      console.log('Found scheduled posts:', scheduledPosts.length);
      console.log(
        'Scheduled posts details:',
        scheduledPosts.map((post) => ({
          id: post.id,
          scheduledTime: post.scheduledTime,
        })),
      );

      // Convert daily slots to a unified format
      const allTimeSlots: { dayOfWeek: number; time: string }[] = [
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.SUNDAY,
          timeSlots.sunday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.MONDAY,
          timeSlots.monday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.TUESDAY,
          timeSlots.tuesday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.WEDNESDAY,
          timeSlots.wednesday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.THURSDAY,
          timeSlots.thursday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.FRIDAY,
          timeSlots.friday,
        ),
        ...this.convertDayToTimeSlots(
          coreConstant.DAYS_OF_WEEK.SATURDAY,
          timeSlots.saturday,
        ),
      ];

      console.log(
        'Converted time slots:',
        JSON.stringify(allTimeSlots, null, 2),
      );

      // Check next 14 days (increased from 7 to handle more future dates)
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + daysAhead);
        const checkDay = checkDate.getDay();

        console.log(`\nChecking day ${daysAhead} ahead:`, {
          date: checkDate,
          dayOfWeek: checkDay,
        });

        // Get available slots for this day
        const daySlots = allTimeSlots
          .filter((slot) => slot.dayOfWeek === checkDay)
          .map((slot) => {
            const [hours, minutes] = slot.time.split(':').map(Number);
            const slotDate = new Date(checkDate);
            slotDate.setHours(hours, minutes, 0, 0);
            return slotDate;
          })
          .filter((slotDate) => slotDate > now);

        console.log(
          'Available slots for this day:',
          daySlots.map((slot) => slot.toISOString()),
        );

        for (const slotDate of daySlots) {
          console.log('\nEvaluating slot:', slotDate);

          // Check if this slot is already taken
          const hasConflict = scheduledPosts.some((post) => {
            const postTime = new Date(post.scheduledTime);
            const timeDiff = Math.abs(slotDate.getTime() - postTime.getTime());
            const minGapInMs = (timeSlots.minTimeGap || 120) * 60 * 1000;
            const hasTimeConflict = timeDiff < minGapInMs;

            console.log('Checking conflict with post:', {
              postTime,
              timeDiff: Math.round(timeDiff / (60 * 1000)) + ' minutes',
              minGap: timeSlots.minTimeGap + ' minutes',
              hasConflict: hasTimeConflict,
            });

            return hasTimeConflict;
          });

          // Count posts on this day
          const postsOnThisDay = scheduledPosts.filter(
            (post) =>
              new Date(post.scheduledTime).toDateString() ===
              slotDate.toDateString(),
          ).length;

          // If no conflict and within daily limit, use this slot
          if (!hasConflict && postsOnThisDay < (timeSlots.postsPerDay || 2)) {
            console.log('Found available slot:', slotDate);
            return slotDate;
          }
        }
      }

      console.log('No available slots found after checking all days');
      return null;
    } catch (error) {
      console.error('Error calculating next available slot:', error);
      return null;
    }
  }

  // Helper method to convert day slots from the database format
  private convertDayToTimeSlots(
    dayOfWeek: number,
    slots: any[],
  ): { dayOfWeek: number; time: string }[] {
    console.log(
      `Converting slots for day ${this.getDayName(dayOfWeek)}:`,
      slots,
    );
    const convertedSlots = slots
      .filter((slot) => slot.isActive !== false)
      .map((slot) => ({
        dayOfWeek,
        time: typeof slot === 'string' ? slot : slot.time,
      }));
    console.log(
      `Converted slots for day ${this.getDayName(dayOfWeek)}:`,
      convertedSlots,
    );
    return convertedSlots;
  }

  // Helper method to get day name
  private getDayName(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case coreConstant.DAYS_OF_WEEK.SUNDAY:
        return 'Sunday';
      case coreConstant.DAYS_OF_WEEK.MONDAY:
        return 'Monday';
      case coreConstant.DAYS_OF_WEEK.TUESDAY:
        return 'Tuesday';
      case coreConstant.DAYS_OF_WEEK.WEDNESDAY:
        return 'Wednesday';
      case coreConstant.DAYS_OF_WEEK.THURSDAY:
        return 'Thursday';
      case coreConstant.DAYS_OF_WEEK.FRIDAY:
        return 'Friday';
      case coreConstant.DAYS_OF_WEEK.SATURDAY:
        return 'Saturday';
      default:
        return 'Unknown';
    }
  }

  private async getNextQueueOrder(linkedInProfileId: string): Promise<number> {
    const lastQueued = await this.prisma.queuedPost.findFirst({
      where: { linkedInProfileId },
      orderBy: { queueOrder: 'desc' },
    });
    return (lastQueued?.queueOrder || 0) + 1;
  }

  async updateTimeSlotSettings(
    userId: string,
    linkedInProfileId: string,
    settings: TimeSlotSettingsDto,
  ): Promise<ResponseModel> {
    try {
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: { id: linkedInProfileId, userId },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      const timeSlots = await this.prisma.postTimeSlot.upsert({
        where: { linkedInProfileId },
        create: {
          linkedInProfileId,
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
          postsPerDay: 2,
          minTimeGap: 120,
        },
        update: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
          postsPerDay: 2,
          minTimeGap: 120,
        },
      });

      return successResponse('Time slot settings updated', {
        monday: timeSlots.monday,
        tuesday: timeSlots.tuesday,
        wednesday: timeSlots.wednesday,
        thursday: timeSlots.thursday,
        friday: timeSlots.friday,
        saturday: timeSlots.saturday,
        sunday: timeSlots.sunday,
        postsPerDay: timeSlots.postsPerDay,
        minTimeGap: timeSlots.minTimeGap,
      });
    } catch (error) {
      return errorResponse(
        `Failed to update time slot settings: ${error.message}`,
      );
    }
  }

  async shuffleQueue(
    userId: string,
    linkedInProfileId: string,
  ): Promise<ResponseModel> {
    try {
      // Verify LinkedIn profile belongs to user
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      // Get all queued posts
      const queuedPosts = await this.prisma.queuedPost.findMany({
        where: {
          linkedInProfileId,
          post: {
            status: coreConstant.POST_STATUS.SCHEDULED,
          },
        },
        include: {
          post: true,
        },
        orderBy: {
          scheduledFor: 'asc',
        },
      });

      if (queuedPosts.length < 2) {
        return errorResponse('Need at least 2 posts to shuffle');
      }

      // Extract existing scheduled times
      const existingTimes = queuedPosts.map((post) => post.scheduledFor);

      // Shuffle the times array
      const shuffledTimes = [...existingTimes].sort(() => Math.random() - 0.5);

      // Update posts with shuffled times
      await this.prisma.$transaction(async (prisma) => {
        for (let i = 0; i < queuedPosts.length; i++) {
          const post = queuedPosts[i];
          const newScheduledTime = shuffledTimes[i];

          // Update LinkedInPost
          await prisma.linkedInPost.update({
            where: { id: post.postId },
            data: {
              scheduledTime: newScheduledTime,
            },
          });

          // Update QueuedPost
          await prisma.queuedPost.update({
            where: { id: post.id },
            data: {
              scheduledFor: newScheduledTime,
              queueOrder: i + 1,
            },
          });

          // Create a log entry
          await prisma.postLog.create({
            data: {
              linkedInPostId: post.postId,
              status: coreConstant.POST_LOG_STATUS.SCHEDULED,
              message: `Post rescheduled to ${newScheduledTime.toISOString()} during queue shuffle`,
            },
          });
        }
      });

      // Fetch and return the updated queue
      const updatedQueue = await this.prisma.queuedPost.findMany({
        where: { linkedInProfileId },
        include: {
          post: {
            include: {
              linkedInProfile: true,
              postLogs: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
              images: true,
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
          },
        },
        orderBy: {
          scheduledFor: 'asc',
        },
      });

      return successResponse('Queue shuffled successfully', {
        shuffledQueue: updatedQueue,
      });
    } catch (error) {
      console.error('Error shuffling queue:', error);
      return errorResponse(`Failed to shuffle queue: ${error.message}`);
    }
  }

  async superGenerator(
    userId: string,
    dto: GenerateAndCreateDraftDto,
  ): Promise<ResponseModel> {
    try {
      // Generate the content using AI
      const generatedContent =
        await this.aiContentService.generateLinkedInPosts(userId, {
          prompt: dto.prompt,
          language: dto.language,
          tone: dto.tone,
          postLength: dto.postLength,
          category: dto.category,
        });

      if (!generatedContent.success) {
        return errorResponse(
          generatedContent.message || 'Failed to generate content',
        );
      }

      return successResponse(
        'AI post generated successfully',
        generatedContent.data,
      );
    } catch (error) {
      return errorResponse(`Failed to generate content: ${error.message}`);
    }
  }
}
