import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  errorResponse,
  processException,
  successResponse,
} from 'src/shared/helpers/functions';
import { ResponseModel } from 'src/shared/models/response.model';
import {
  paginatedQuery,
  PaginationOptions,
} from 'src/shared/utils/pagination.util';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(): Promise<ResponseModel> {
    try {
      const [
        totalCarousels,
        activeSubscriptions,
        totalUsers,
        verifiedUsers,
        recentCarousels,
        carouselCreationOverview,
        userSubscriptions,
        userDetails,
      ] = await Promise.all([
        this.getTotalCarousels(),
        this.getActiveSubscriptions(),
        this.getTotalUsers(),
        this.getVerifiedUsers(),
        this.getRecentCarousels(),
        this.getCarouselCreationOverview(),
        this.getUserSubscriptions(),
        this.getUserDetails(),
      ]);

      return successResponse('Retrieved dashboard data', {
        totalCarousels,
        activeSubscriptions,
        totalUsers,
        verifiedUsers,
        recentCarousels,
        carouselCreationOverview,
        userSubscriptions,
        userDetails,
      });
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  async getCarousels(options: PaginationOptions): Promise<ResponseModel> {
    try {
      const carousels = await paginatedQuery(
        this.prisma,
        'carousel',
        {},
        options,
        {
          user: { // Directly specify the relation here
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        }
      );
      return successResponse('Retrieved carousels', carousels);
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  async getUsers(options: PaginationOptions): Promise<ResponseModel> {
    try {
      const users = await paginatedQuery(this.prisma, 'user', {}, options);
      return successResponse('Retrieved users', users);
    } catch (error) {
      processException(error);
    }
  }

  async getSubscriptions(options: PaginationOptions): Promise<ResponseModel> {
    try {
      const subscriptions = await paginatedQuery(
        this.prisma,
        'subscription',
        {},
        options,
      );
      return successResponse('Retrieved subscriptions', subscriptions);
    } catch (error) {
      processException(error);
    }
  }

  private async getTotalCarousels(): Promise<number> {
    return this.prisma.carousel.count();
  }

  private async getActiveSubscriptions(): Promise<number> {
    return this.prisma.subscription.count({
      where: {
        endDate: {
          gte: new Date(),
        },
      },
    });
  }

  private async getTotalUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  private async getVerifiedUsers(): Promise<number> {
    return this.prisma.user.count({
      where: {
        email_verified: 1,
      },
    });
  }

  private async getRecentCarousels(limit: number = 5) {
    return this.prisma.carousel.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  private async getCarouselCreationOverview() {
    const currentYear = new Date().getFullYear();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const carouselCounts = await Promise.all(
      months.map((_, index) =>
        this.prisma.carousel.count({
          where: {
            createdAt: {
              gte: new Date(currentYear, index, 1),
              lt: new Date(currentYear, index + 1, 1),
            },
          },
        }),
      ),
    );

    const overview = months.map((month, index) => ({
      month,
      total: carouselCounts[index],
    }));

    return overview;
  }

  private async getUserSubscriptions() {
    return this.prisma.subscription.findMany({
      select: {
        productName: true,
        totalAmount: true,
        subscriptionLengthInMonths: true,
        currency: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Limit to 10 most recent subscriptions, adjust as needed
    });
  }

  private async getUserDetails() {
    return this.prisma.user.findMany({
      select: {
        email: true,
        role: true,
        status: true,
        is_subscribed: true,
        email_verified: true,
        phone_verified: true,
      },
      take: 10, // Limit to 10 users, adjust as needed
    });
  }
}
