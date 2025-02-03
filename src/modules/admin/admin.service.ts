import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { UsersService } from '../users/users.service';
import { CreatePackageDto } from '../subscription/dto/create-package.dto';
import { UpdatePackageDto } from '../subscription/dto/update-package.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { coreConstant } from 'src/shared/helpers/coreConstant';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly usersService: UsersService,
  ) {}

  // Package Management
  async createPackage(
    createPackageDto: CreatePackageDto,
  ): Promise<ResponseModel> {
    try {
      // If this is a trial package, check if one already exists and validate trial duration
      if (createPackageDto.is_trial_package) {
        if (!createPackageDto.trial_duration_days) {
          return errorResponse(
            'Trial duration days is required for trial packages',
          );
        }

        const existingTrialPackage = await this.prisma.package.findFirst({
          where: {
            is_trial_package: true,
            status: { not: 'deprecated' },
          },
        });

        if (existingTrialPackage) {
          return errorResponse(
            'A trial package already exists. Please update the existing one or deprecate it first.',
          );
        }
      }

      // Check if package with same name or variantId exists
      const existingPackage = await this.prisma.package.findFirst({
        where: {
          OR: [
            { name: createPackageDto.name },
            { variantId: createPackageDto.variantId },
          ],
        },
      });

      if (existingPackage) {
        return errorResponse(
          'Package with same name or variant ID already exists',
        );
      }

      const package_ = await this.prisma.package.create({
        data: createPackageDto,
      });

      return successResponse('Package created successfully', package_);
    } catch (error) {
      this.logger.error(`Error creating package: ${error.message}`);
      return errorResponse('Failed to create package');
    }
  }

  async updatePackage(
    id: string,
    updatePackageDto: UpdatePackageDto,
  ): Promise<ResponseModel> {
    try {
      // Check if package exists
      const existingPackage = await this.prisma.package.findUnique({
        where: { id },
      });

      if (!existingPackage) {
        return errorResponse('Package not found');
      }

      // Check for unique constraints if name or variantId is being updated
      if (updatePackageDto.name || updatePackageDto.variantId) {
        const duplicatePackage = await this.prisma.package.findFirst({
          where: {
            OR: [
              updatePackageDto.name
                ? { name: updatePackageDto.name }
                : undefined,
              updatePackageDto.variantId
                ? { variantId: updatePackageDto.variantId }
                : undefined,
            ].filter(Boolean),
            NOT: { id },
          },
        });

        if (duplicatePackage) {
          return errorResponse(
            'Package with same name or variant ID already exists',
          );
        }
      }

      const updatedPackage = await this.prisma.package.update({
        where: { id },
        data: updatePackageDto,
      });

      return successResponse('Package updated successfully', updatedPackage);
    } catch (error) {
      this.logger.error(`Error updating package: ${error.message}`);
      return errorResponse('Failed to update package');
    }
  }

  async deletePackage(id: string): Promise<ResponseModel> {
    try {
      // Check if package exists
      const existingPackage = await this.prisma.package.findUnique({
        where: { id },
        include: {
          subscriptions: {
            where: { status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE },
          },
        },
      });

      if (!existingPackage) {
        return errorResponse('Package not found');
      }

      // If package has active subscriptions, mark it as deprecated instead of deleting
      if (existingPackage.subscriptions.length > 0) {
        const updatedPackage = await this.prisma.package.update({
          where: { id },
          data: { status: 'deprecated' },
        });
        return successResponse(
          'Package marked as deprecated due to active subscriptions',
          updatedPackage,
        );
      }

      // Delete the package if no active subscriptions
      await this.prisma.package.delete({ where: { id } });
      return successResponse('Package deleted successfully');
    } catch (error) {
      this.logger.error(`Error deleting package: ${error.message}`);
      return errorResponse('Failed to delete package');
    }
  }

  async getPackageById(id: string): Promise<ResponseModel> {
    try {
      const package_ = await this.prisma.package.findUnique({
        where: { id },
        include: {
          subscriptions: {
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
          },
        },
      });

      if (!package_) {
        return errorResponse('Package not found');
      }

      return successResponse('Package retrieved successfully', package_);
    } catch (error) {
      this.logger.error(`Error retrieving package: ${error.message}`);
      return errorResponse('Failed to retrieve package');
    }
  }

  async getAllPackages(): Promise<ResponseModel> {
    try {
      const packages = await this.prisma.package.findMany({
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE },
              },
            },
          },
        },
        orderBy: { price: 'asc' },
      });

      const formattedPackages = packages.map((pkg) => ({
        ...pkg,
        activeSubscriptions: pkg._count.subscriptions,
      }));

      return successResponse(
        'Packages retrieved successfully',
        formattedPackages,
      );
    } catch (error) {
      this.logger.error(`Error retrieving packages: ${error.message}`);
      return errorResponse('Failed to retrieve packages');
    }
  }

  // Subscription Management
  async giveSubscription(
    email: string,
    durationInMonths: number,
  ): Promise<ResponseModel> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return errorResponse('User not found');
      }

      // Get Pro package
      const proPackage = await this.prisma.package.findFirst({
        where: { name: 'Pro' },
      });

      if (!proPackage) {
        return errorResponse('Pro package not found');
      }

      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + durationInMonths);

      const nextResetDate = new Date(now);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      const subscription = await this.prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          packageId: proPackage.id,
          status: 'active',
          orderId: `ADMIN_${Date.now()}`,
          startDate: now,
          endDate,
          nextWordResetDate: nextResetDate,
          monthlyWordLimit: proPackage.monthlyWordLimit,
          billingCycle: 'monthly',
          currency: proPackage.currency,
        },
        update: {
          packageId: proPackage.id,
          status: 'active',
          endDate,
          monthlyWordLimit: proPackage.monthlyWordLimit,
        },
      });

      return successResponse('Subscription given successfully', {
        subscription,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    } catch (error) {
      this.logger.error(`Error giving subscription: ${error.message}`);
      return errorResponse(`Failed to give subscription: ${error.message}`);
    }
  }

  async getAllSubscriptions(): Promise<ResponseModel> {
    try {
      const subscriptions = await this.prisma.subscription.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              user_name: true,
            },
          },
          package: {
            select: {
              name: true,
              type: true,
              price: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const now = new Date();
      const formattedSubscriptions = subscriptions.map((sub) => ({
        id: sub.id,
        status: sub.status,
        endDate: sub.endDate,
        startDate: sub.startDate,
        package: sub.package,
        user: sub.user,
        isActive: sub.endDate > now,
        isTrial: sub.isTrial,
        usage: {
          words: {
            used: sub.wordsGenerated,
            limit: sub.monthlyWordLimit,
          },
        },
        daysRemaining: Math.ceil(
          (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      }));

      return successResponse(
        'Subscriptions retrieved successfully',
        formattedSubscriptions,
      );
    } catch (error) {
      this.logger.error(`Error retrieving subscriptions: ${error.message}`);
      return errorResponse('Failed to retrieve subscriptions');
    }
  }

  // Dashboard Data
  async getDashboardData(): Promise<ResponseModel> {
    return this.usersService.getAdminDashboardData();
  }
}
