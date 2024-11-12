import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  uploadFile,
  deleteFileFromS3,
} from '../../shared/configs/multer-upload.config';
import { ResponseModel } from 'src/shared/models/response.model';
import { errorResponse, successResponse } from 'src/shared/helpers/functions';
import {
  PaginationOptions,
  paginatedQuery,
} from 'src/shared/utils/pagination.util';
import { GetFileDto } from './dto/get-file.dto';
import { plainToClass } from 'class-transformer';
import * as fs from 'fs/promises';
import { SubscriptionService } from '../subscription/subscription.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { User } from '@prisma/client';

@Injectable()
export class FileService {
  private s3Client: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const imageUsage: any = await this.getImageUsage(user.id);
      if (imageUsage.data.totalSize >= coreConstant.MAX_IMAGE_SIZE) {
        return errorResponse('User has reached the limit of 500MB');
      }

      console.log('Attempting to upload file:', file.originalname);
      const url = await uploadFile(file, user.id);
      if (!url) {
        console.error('uploadFile function returned null');
        return errorResponse('File upload to S3 failed');
      }

      console.log('File uploaded successfully to S3. URL:', url);

      // Extract the path from the S3 URL
      const path = new URL(url).pathname;

      console.log('Creating file record in database');
      const newFile = await this.prisma.file.create({
        data: {
          name: file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: url,
          path: path,
          user: { connect: { id: user.id } },
        },
      });

      console.log('File record created successfully:', newFile.id);

      const fileResponse = plainToClass(GetFileDto, newFile, {
        excludeExtraneousValues: true,
      });
      return successResponse('File uploaded successfully', fileResponse);
    } catch (error) {
      console.error('Detailed upload error:', error);
      if (error instanceof Error) {
        return errorResponse(`File upload failed: ${error.message}`);
      }
      return errorResponse('File upload failed due to an unknown error');
    }
  }

  async getFiles(
    user: User,
    options: PaginationOptions = {},
  ): Promise<ResponseModel> {
    try {
      const result = await paginatedQuery(
        this.prisma,
        'file',
        { userId: user.id },
        { ...options, orderBy: { createdAt: 'desc' } },
      );

      if (result.items.length === 0) {
        return errorResponse('No files found for this user');
      }

      const fileResponses = result.items.map((item) =>
        plainToClass(GetFileDto, item, { excludeExtraneousValues: true }),
      );
      return successResponse('Files found successfully', {
        ...result,
        items: fileResponses,
      });
    } catch (error) {
      return errorResponse('Error fetching files');
    }
  }

  async getFile(id: number): Promise<ResponseModel> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id },
      });
      if (!file) {
        return errorResponse('File not founds');
      }
      const fileResponse = plainToClass(GetFileDto, file, {
        excludeExtraneousValues: true,
      });
      return successResponse('File found successfully', fileResponse);
    } catch (error) {
      return errorResponse('Error fetching file');
    }
  }

  async deleteFile(id: number, user: User): Promise<ResponseModel> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id, userId: user.id },
      });

      if (!file) {
        return errorResponse('File not found');
      }

      // Delete the file from S3
      await deleteFileFromS3(file.url);

      // Delete the file record from the database
      const deletedFile = await this.prisma.file.delete({
        where: { id, userId: user.id },
      });

      const fileResponse = plainToClass(GetFileDto, deletedFile, {
        excludeExtraneousValues: true,
      });
      return successResponse('File deleted successfully', fileResponse);
    } catch (error) {
      console.error('Error deleting file:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return errorResponse('Error deleting file');
    }
  }

  async getImageUsage(userId: number): Promise<ResponseModel> {
    console.log('calling usage');
    try {
      const totalCount = await this.prisma.file.count({
        where: { userId },
      });
      console.log(totalCount, 'totalCount');

      const totalSize = await this.prisma.file.aggregate({
        where: { userId },
        _sum: {
          size: true,
        },
      });
      console.log(totalSize, 'totalSize');
      const usage = {
        totalCount,
        totalSize: totalSize._sum.size || 0,
      };
      if (totalCount === 0) {
        return successResponse('No images found for this user', usage);
      }

      return successResponse('Image usage retrieved successfully', usage);
    } catch (error) {
      return errorResponse('Failed to retrieve image usage');
    }
  }

  async uploadFileAndGetUrl(
    file: Express.Multer.File,
    user: User,
  ): Promise<string> {
    // Check subscription
    const isSubscribed = await this.subscriptionService.checkSubscription(user);
    if (!isSubscribed.isSubscribed) {
      throw new Error(
        'User is not subscribed, please subscribe to upload files',
      );
    }

    // Check storage limit
    const imageUsage: any = await this.getImageUsage(user.id);
    if (imageUsage.data.totalSize >= coreConstant.MAX_IMAGE_SIZE) {
      throw new Error('User has reached the limit of 500MB');
    }

    // Upload file to S3
    console.log('Attempting to upload file:', file.originalname);
    const url = await uploadFile(file, user.id);
    if (!url) {
      throw new Error('File upload to S3 failed');
    }

    // Extract the path from the S3 URL
    const path = new URL(url).pathname;

    // Create file record in database
    await this.prisma.file.create({
      data: {
        name: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: url,
        path: path,
        user: { connect: { id: user.id } },
      },
    });

    return url;
  }
}
