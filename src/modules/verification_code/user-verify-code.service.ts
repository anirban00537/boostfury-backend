import { Injectable } from '@nestjs/common';
import {
  PrismaClient,
  addDayWithCurrentDate,
  errorResponse,
  successResponse,
} from 'src/shared/helpers/functions';
import { PrismaService } from '../prisma/prisma.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';

@Injectable()
export class UserVerificationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserCode(payload: any) {
    try {
      const checkExists = await this.prisma.userVerificationCodes.findMany({
        where: {
          user_id: payload.user_id,
          type: payload.type,
        },
      });
      if (checkExists.length > 0) {
        await this.prisma.userVerificationCodes.deleteMany({
          where: {
            user_id: payload.user_id,
            type: payload.type,
          },
        });
      }
      const createData = await this.prisma.userVerificationCodes.create({
        data: {
          user_id: payload.user_id,
          code: payload.code.toString(),
          type: payload.type,
          status: coreConstant.STATUS_ACTIVE,
          expired_at: addDayWithCurrentDate(5),
        },
      });
      return successResponse('Success', createData);
    } catch (err) {
      return errorResponse('Something went wrong');
    }
  }
  async verifyUserCode(user_id: number, code: string, type: number) {
    const userCode = await PrismaClient.userVerificationCodes.findFirst({
      where: {
        user_id: user_id,
        code,
        type,
        status: coreConstant.STATUS_ACTIVE,
        expired_at: {
          gte: new Date(),
        },
      },
    });

    if (!userCode) {
      return errorResponse('Invalid or expired verification code');
    }

    await PrismaClient.userVerificationCodes.delete({
      where: {
        code: code,
      },
    });
   

    return successResponse('Verification code successfully validated');
  }
}
