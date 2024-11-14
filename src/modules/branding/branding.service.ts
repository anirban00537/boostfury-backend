import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUpdateBrandingDto } from './dto/create-update-branding.dto';
import { UserBranding } from '@prisma/client';
import { ResponseModel } from 'src/shared/models/response.model';
import { errorResponse, successResponse } from 'src/shared/helpers/functions';
import {
  uploadFile,
  deleteFileFromS3,
} from 'src/shared/configs/multer-upload.config';
import { plainToClass } from 'class-transformer';
import { BrandingResponseDto } from './dto/branding-response.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async createUpdateBranding(
    userId: string,
    createUpdateBrandingDto: CreateUpdateBrandingDto,
    headshot?: Express.Multer.File,
  ): Promise<ResponseModel> {
    try {
      console.log('Received headshot in service:', headshot);
      let headshotUrl: string | null = null;

      const existingBranding = await this.prisma.userBranding.findUnique({
        where: { userId },
      });

      if (headshot) {
        // Delete existing headshot if it exists
        if (existingBranding && existingBranding.headshot) {
          await deleteFileFromS3(existingBranding.headshot);
        }

        headshotUrl = await uploadFile(headshot, userId);
        console.log('Headshot upload result:', headshotUrl);
      }

      let userBranding: UserBranding;

      if (existingBranding) {
        // Update existing branding
        userBranding = await this.prisma.userBranding.update({
          where: { userId },
          data: {
            name: createUpdateBrandingDto.name,
            handle: createUpdateBrandingDto.handle,
            headshot: headshotUrl || existingBranding.headshot,
          },
        });
        if (!userBranding) {
          return errorResponse('Failed to update branding');
        }
      } else {
        userBranding = await this.prisma.userBranding.create({
          data: {
            userId,
            name: createUpdateBrandingDto.name,
            handle: createUpdateBrandingDto.handle,
            headshot: headshotUrl,
          },
        });
        if (!userBranding) {
          return errorResponse('Failed to create branding');
        }
      }
      return successResponse('Branding updated successfully', {
        branding: userBranding,
      });
    } catch (error) {
      console.error('Error in createUpdateBranding:', error);
      return errorResponse('Failed to create or update branding');
    }
  }

  private async deleteExistingHeadshot(headshotUrl: string): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), headshotUrl);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting existing headshot:', error);
    }
  }

  async getBranding(userId: string): Promise<ResponseModel> {
    try {
      const userBranding = await this.prisma.userBranding.findUnique({
        where: { userId },
      });
      if (!userBranding) {
        return errorResponse('Branding not found');
      }
      const brandingResponse = plainToClass(BrandingResponseDto, userBranding);
      return successResponse('Branding retrieved successfully', {
        branding: brandingResponse,
      });
    } catch (error) {
      console.error('Error in getBranding:', error);
      return errorResponse('Failed to retrieve branding');
    }
  }
}
