import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { UsersService } from '../users/users.service';
import { CreatePackageDto } from '../subscription/dto/create-package.dto';
import { UpdatePackageDto } from '../subscription/dto/update-package.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import {
  PaginationOptions,
  paginatedQuery,
} from 'src/shared/utils/pagination.util';
import { User } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly usersService: UsersService,
  ) {}

  // User Management
  async getAllUsers(options: PaginationOptions & { search?: string }) {
    try {
      const where = options.search
        ? {
            OR: [
              { email: { contains: options.search, mode: 'insensitive' } },
              { first_name: { contains: options.search, mode: 'insensitive' } },
              { last_name: { contains: options.search, mode: 'insensitive' } },
              { user_name: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {};

      const result = await paginatedQuery<User>(
        this.prisma,
        'user',
        where,
        options,
        {
          // Include related data
          Subscription: {
            include: {
              package: true,
            },
          },
          UserBranding: true,
          LinkedInProfiles: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isDefault: true,
            },
          },
        },
      );

      // Transform user data to exclude sensitive information
      const sanitizedUsers = result.items.map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_name: user.user_name,
        photo: user.photo,
        country: user.country,
        status: user.status,
        role: user.role,
        is_subscribed: user.is_subscribed,
        email_verified: user.email_verified,
        createdAt: user.createdAt,
        subscription: (user as any).Subscription,
        branding: (user as any).UserBranding,
        linkedInProfiles: (user as any).LinkedInProfiles,
      }));

      return successResponse('Users retrieved successfully', {
        items: sanitizedUsers,
        pagination: result.pagination,
      });
    } catch (error) {
      this.logger.error(`Error retrieving users: ${error.message}`);
      return errorResponse('Failed to retrieve users');
    }
  }

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
          },
        });

        if (existingTrialPackage) {
          return errorResponse(
            'Only one trial package can exist in the system. Please update the existing trial package instead of creating a new one.',
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
          subscriptions: true,
        },
      });

      if (!existingPackage) {
        return errorResponse('Package not found');
      }

      // If package has any subscriptions (active or inactive), prevent deletion
      if (existingPackage.subscriptions.length > 0) {
        // If not already deprecated, mark it as deprecated
        if (existingPackage.status !== 'deprecated') {
          const updatedPackage = await this.prisma.package.update({
            where: { id },
            data: { status: 'deprecated' },
          });
          return errorResponse(
            'Package cannot be deleted because it has subscriptions (current or past). It has been marked as deprecated instead.',
            updatedPackage,
          );
        }
        return errorResponse(
          'Package cannot be deleted because it has subscriptions (current or past). It is already marked as deprecated.',
        );
      }

      // Delete the package if no subscriptions exist
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
