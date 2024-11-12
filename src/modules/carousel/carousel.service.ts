import { Injectable } from '@nestjs/common';
import { CreateCarouselDto } from './dto/create-carousel.dto';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCarouselDto } from './dto/update-carousel.dto';
import {
  paginatedQuery,
  PaginationOptions,
} from 'src/shared/utils/pagination.util';
import { Carousel } from '@prisma/client';
import { ApiUnsupportedMediaTypeResponse } from '@nestjs/swagger';
import { ResponseModel } from 'src/shared/models/response.model';
import { errorResponse, successResponse } from 'src/shared/helpers/functions';
import { CarouselPaginationOptions } from './types/carousel';
import { deleteFileFromS3, uploadFile } from 'src/shared/configs/multer-upload.config';
import { ContentPostingService } from '../content-posting/content-posting.service';
import { PostType } from '../content-posting/dto/create-draft-post.dto';

@Injectable()
export class CarouselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentPostingService: ContentPostingService,
  ) {}

  async createCarousel(
    createCarouselDto: CreateCarouselDto,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const carousel = await this.prisma.carousel.create({
        data: {
          data: createCarouselDto.data as Prisma.InputJsonValue,
          workspace: {
            connect: {
              id: createCarouselDto.workspaceId,
            },
          },
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });

      if (!carousel) {
        return errorResponse('Carousel not created');
      }
      return successResponse('Carousel created successfully', carousel);
    } catch (error) {
      console.error('Error creating carousel:', error);
      return errorResponse('Carousel not created');
    }
  }

  async updateCarousel(
    updateCarouselDto: UpdateCarouselDto,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const carousel = await this.prisma.carousel.update({
        where: {
          id: updateCarouselDto.id,
          userId: user.id,
        },
        data: {
          data: updateCarouselDto.data as Prisma.InputJsonValue,
        },
      });
      if (!carousel) {
        return errorResponse('Carousel not updated');
      }
      return successResponse('Carousel updated successfully', carousel);
    } catch (error) {
      console.log(error);
      return errorResponse('Carousel not updated');
    }
  }

  async deleteCarousel(id: number, user: User): Promise<ResponseModel> {
    try {
      const carousel = await this.prisma.carousel.delete({
        where: {
          id,
          userId: user.id,
        },
      });
      if (!carousel) {
        return errorResponse('Carousel not deleted');
      }
      return successResponse('Carousel deleted successfully', carousel);
    } catch (error) {
      return errorResponse('Carousel not deleted');
    }
  }

  async getCarousel(
    id: number,
    user: User,
    workspaceId?: number,
  ): Promise<ResponseModel> {
    try {
      const carousel = await this.prisma.carousel.findUnique({
        where: {
          id,
          userId: user.id,
          workspaceId: workspaceId,
        },
      });
      if (!carousel) {
        return errorResponse('Carousel not found', null);
      }
      return successResponse('Carousel found successfully', carousel);
    } catch (error) {
      return errorResponse('Carousel not found');
    }
  }

  async getCarouselsByUser(
    user: User,
    options: CarouselPaginationOptions = {},
    workspaceId: number,
  ): Promise<ResponseModel> {
    try {
      const result = await paginatedQuery(
        this.prisma,
        'carousel',
        { userId: user.id, workspaceId: workspaceId },
        { ...options, orderBy: { createdAt: 'desc' } },
      );

      if (result.items.length === 0) {
        return errorResponse('No carousels found for this user');
      }

      return successResponse('Carousels found successfully', result);
    } catch (error) {
      console.log(error, 'errosr');
      return errorResponse('Error fetching carousels');
    }
  }

  async getAllCarousels(
    options: PaginationOptions = {},
  ): Promise<ResponseModel> {
    try {
      const result = await paginatedQuery(
        this.prisma,
        'carousel',
        {},
        { ...options, orderBy: { createdAt: 'desc' } },
      );
      if (!result.items.length) {
        return errorResponse('No carousels found', result);
      }
      return successResponse('Here is your carousels', result);
    } catch (error) {}
  }

  async scheduleCarousel(
    documentUrl: string,
    carouselId: number,
    content: string,
    user: User,
  ): Promise<ResponseModel> {
    try {
      // Get carousel data
      const carousel = await this.prisma.carousel.findFirst({
        where: {
          id: carouselId,
          userId: user.id,
        },
        include: {
          workspace: true,
        },
      });

      if (!carousel) {
        return errorResponse('Carousel not found');
      }

      // Create draft post
      console.log('Creating draft post...');
      const draftPostData = {
        content: content,
        postType: PostType.DOCUMENT,
        workspaceId: carousel.workspaceId,
        documentUrl: documentUrl,
      };

      const createDraftResponse = await this.contentPostingService.createOrUpdateDraftPost(
        user.id,
        draftPostData,
      );

      if (!createDraftResponse.success) {
        return errorResponse(`Failed to create draft: ${createDraftResponse.message}`);
      }

      return successResponse('Carousel scheduled successfully', {
        post: createDraftResponse.data,
        documentUrl,
      });

    } catch (error) {
      console.error('Error scheduling carousel:', error);
      return errorResponse(`Failed to schedule carousel: ${error.message}`);
    }
  }
}
