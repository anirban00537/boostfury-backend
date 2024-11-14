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
import { coreConstant } from 'src/shared/helpers/coreConstant';

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
        subscriptionStats,
      ] = await Promise.all([
        this.getTotalCarousels(),
        this.getActiveSubscriptions(),
        this.getTotalUsers(),
        this.getVerifiedUsers(),
        this.getRecentCarousels(),
        this.getCarouselCreationOverview(),
        this.getUserSubscriptions(),
        this.getUserDetails(),
        this.getSubscriptionStats(),
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
        subscriptionStats,
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
          user: {
            // Directly specify the relation here
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
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
        {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              }
            },
            package: {
              select: {
                name: true,
                price: true,
                currency: true,
              }
            }
          }
        }
      );
      return successResponse('Retrieved subscriptions', subscriptions);
    } catch (error) {
      return errorResponse(error.message);
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
        status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
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
        package: {
          select: {
            name: true,
            price: true,
            currency: true,
          },
        },
        monthlyWordLimit: true,
        wordsGenerated: true,
        linkedInPostsUsed: true,
        carouselsGenerated: true,
        status: true,
        endDate: true,
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      where: {
        status: {
          in: [
            coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
            coreConstant.SUBSCRIPTION_STATUS.TRIAL,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }

  private async getUserDetails() {
    return this.prisma.user.findMany({
      select: {
        email: true,
        role: true,
        status: true,
        email_verified: true,
        phone_verified: true,
        Subscription: {
          select: {
            status: true,
            endDate: true,
            package: {
              select: {
                name: true,
              }
            }
          }
        }
      },
      where: {
        email_verified: 1,
      },
      take: 10,
    });
  }

  private async getSubscriptionStats() {
    const now = new Date();
    return {
      active: await this.prisma.subscription.count({
        where: {
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
          endDate: { gte: now },
        },
      }),
      trial: await this.prisma.subscription.count({
        where: {
          status: coreConstant.SUBSCRIPTION_STATUS.TRIAL,
          endDate: { gte: now },
        },
      }),
      expired: await this.prisma.subscription.count({
        where: {
          OR: [
            { status: coreConstant.SUBSCRIPTION_STATUS.EXPIRED },
            { endDate: { lt: now } },
          ],
        },
      }),
      cancelled: await this.prisma.subscription.count({
        where: {
          status: coreConstant.SUBSCRIPTION_STATUS.CANCELLED,
        },
      }),
    };
  }
}
