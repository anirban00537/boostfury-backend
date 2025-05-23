import { Injectable, Request } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  createUniqueCode,
  errorResponse,
  generateMailKey,
  hashedPassword,
  paginatioOptions,
  paginationMetaData,
  processException,
  successResponse,
} from 'src/shared/helpers/functions';
import { CreateUserDto } from './dto/create-user.dto';

import { ForgotPassMailNotification } from 'src/notifications/user/forgot-pass-mail-notification';
import { PrismaService } from '../prisma/prisma.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { UserVerificationCodeService } from '../verification_code/user-verify-code.service';
import { NotificationService } from 'src/shared/notification/notification.service';
import { ResponseModel } from 'src/shared/models/response.model';
import { UpdateUserDto } from './dto/update-user.dto';
import { AiContentService } from '../ai-content/ai-content.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCodeService: UserVerificationCodeService,
    private readonly notificationService: NotificationService,
    private readonly aiContentService: AiContentService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async checkEmailNickName(email: string, nickName: string) {
    const checkUniqueEmail = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (checkUniqueEmail) {
      return errorResponse('Email already exists', []);
    }
    const checkUniqueNickName = await this.prisma.user.findUnique({
      where: { user_name: nickName },
    });
    if (checkUniqueNickName) {
      return errorResponse('Nickname already exists', []);
    }
    return successResponse('success', []);
  }

  /** Creates a new user */
  async create(payload: CreateUserDto): Promise<any> {
    try {
      const checkUniqueEmail = await this.checkEmailNickName(
        payload.email,
        payload.user_name,
      );
      if (checkUniqueEmail.success == false) {
        return checkUniqueEmail;
      }
      const hashPassword = await hashedPassword(coreConstant.COMMON_PASSWORD);
      const lowerCaseEmail = payload.email.toLowerCase();
      const data = {
        ...payload,
        email: lowerCaseEmail,
        password: hashPassword,
      };
      const user = await this.createNewUser(data);
      if (user.success == true) {
        return successResponse('New user created successful', user.data);
      } else {
        return user;
      }
    } catch (err) {
      console.log(err);
    }
    return errorResponse('Something went wrong', []);
  }

  // create new user process
  async createNewUser(payload: any): Promise<ResponseModel> {
    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the user
        const user = await prisma.user.create({
          data: {
            ...payload,
            unique_code: createUniqueCode(),
          },
        });

        // Create a default LinkedIn profile

        return { user };
      });
      console.log(result, 'result');
      if (result.user) {
        console.log('entered here');
        // Start trial subscription
        const trialResult =
          await this.subscriptionService.createTrialSubscription(
            result.user.id,
          );
        console.log(trialResult, 'logissssssssssssssssssssssssssssn');

        return successResponse(
          'New user created successfully with trial subscription',
          result.user,
        );
      }
    } catch (err) {
      console.error('Error creating new user:', err);
      return errorResponse('Something went wrong', []);
    }
  }

  // get user by email
  async findByEmail(email: string): Promise<User> {
    const lowerCaseEmail = email.toLowerCase();

    return this.prisma.user.findUnique({ where: { email: lowerCaseEmail } });
  }

  // get user by id
  async findById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id: id } });
  }

  // get user list
  async userList(payload: any) {
    try {
      const paginate = await paginatioOptions(payload);

      const userList = await this.prisma.user.findMany({
        ...paginate,
      });

      const userListWithoutPassword = userList.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      const total = await this.prisma.user.count();
      const lastPage = Math.ceil(total / paginate.take);

      const paginationMeta = await paginationMetaData('user', payload);
      console.log(paginationMeta);

      const data = {
        list: userListWithoutPassword,
        meta: paginationMeta,
      };
      return successResponse('User List', data);
    } catch (error) {
      processException(error);
    }
  }

  // send forgot password email
  async sendForgotPasswordEmailProcess(email: string) {
    try {
      const user = await this.findByEmail(email);
      if (user) {
        const mailKey = generateMailKey();
        const codeData = {
          user_id: user.id,
          code: mailKey,
          type: coreConstant.VERIFICATION_TYPE_EMAIL,
        };
        const mailData = {
          verification_code: mailKey,
        };
        await this.userCodeService.createUserCode(codeData);
        this.notificationService.send(
          new ForgotPassMailNotification(mailData),
          user,
        );
      } else {
        return successResponse('User not found', []);
      }
    } catch (err) {
      console.log(err);
    }
    return errorResponse('Something went wrong');
  }

  async updateProfile(
    user: User,
    payload: UpdateUserDto,
  ): Promise<ResponseModel> {
    try {
      const exist = await this.prisma.user.findFirst({
        where: {
          email: {
            not: {
              equals: user.email,
            },
          },
          user_name: payload.user_name,
        },
      });
      if (exist) {
        return errorResponse('Username has been already taken!');
      }
      const updatedUser = await this.prisma.user.update({
        where: {
          email: user.email,
        },
        data: {
          ...payload,
          birth_date: new Date(payload.birth_date),
          gender: Number(payload.gender),
        },
      });

      return successResponse('Profile is updated successfully!', updatedUser);
    } catch (error) {
      processException(error);
    }
  }

  async checkUserNameIsUnique(
    user: User,
    payload: {
      user_name: string;
    },
  ) {
    try {
      const checkUserNameExists = await this.prisma.user.findFirst({
        where: {
          email: {
            not: {
              equals: user.email,
            },
          },
          user_name: payload.user_name,
        },
      });

      if (checkUserNameExists) {
        return errorResponse('This name has been already taken!');
      } else {
        return successResponse('This name is unique!');
      }
    } catch (error) {
      processException(error);
    }
  }

  async changeStatus(payload: { user_id: string }) {
    try {
      if (!payload.user_id) {
        return errorResponse('User Id field is required!');
      }

      const user_id = payload.user_id;
      const userDetails = await this.prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });
      if (userDetails) {
        const status =
          coreConstant.STATUS_ACTIVE == userDetails.status
            ? coreConstant.STATUS_INACTIVE
            : coreConstant.STATUS_ACTIVE;

        const updateUserDetails = await this.prisma.user.update({
          where: {
            id: payload.user_id,
          },
          data: {
            status: status,
          },
        });
        delete updateUserDetails.password;
        return successResponse(
          'Status is updated successfully!',
          updateUserDetails,
        );
      } else {
        return errorResponse('User is not found!');
      }
    } catch (error) {
      processException(error);
    }
  }

  async userListByCountryWise() {
    try {
      const userList = await this.prisma.user.groupBy({
        by: ['country'],
        _count: true,
      });

      console.log(userList);

      return successResponse('Country wise user list', userList);
    } catch (error) {
      processException(error);
    }
  }

  async userProfileDetails(payload: { user_id: string }) {
    try {
      if (!payload.user_id) {
        return errorResponse('User Id field is required!');
      }

      const user_id = payload.user_id;
      const userDetails = await this.prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });

      if (userDetails) {
        delete userDetails.password;

        return successResponse('User Details', userDetails);
      } else {
        return errorResponse('User is not found!');
      }
    } catch (error) {
      processException(error);
    }
  }

  async getAdminDashboardData(): Promise<ResponseModel> {
    try {
      const [
        totalUsers,
        activeUsers,
        totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        totalWordGeneration,
        packageStats,
        recentUsers,
        recentSubscriptions,
        usersByLoginProvider,
        subscriptionsByType,
      ] = await Promise.all([
        // Total users count
        this.prisma.user.count(),

        // Active users count
        this.prisma.user.count({
          where: { status: coreConstant.STATUS_ACTIVE },
        }),

        // Total subscriptions
        this.prisma.subscription.count(),

        // Active subscriptions
        this.prisma.subscription.count({
          where: { status: 'active' },
        }),

        // Trial subscriptions
        this.prisma.subscription.count({
          where: { isTrial: true },
        }),

        // Total word generation usage
        this.prisma.subscription.aggregate({
          _sum: { wordsGenerated: true },
        }),

        // Package statistics
        this.prisma.subscription.groupBy({
          by: ['packageId'],
          _count: true,
          where: { status: 'active' },
          orderBy: { packageId: 'asc' },
        }),

        // Recent users (last 5)
        this.prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            createdAt: true,
            status: true,
          },
        }),

        // Recent subscriptions (last 5)
        this.prisma.subscription.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                email: true,
                first_name: true,
                last_name: true,
              },
            },
            package: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        }),

        // Users by login provider
        this.prisma.user.groupBy({
          by: ['login_provider'],
          _count: true,
        }),

        // Subscriptions by type (monthly, yearly, lifetime)
        this.prisma.subscription.groupBy({
          by: ['billingCycle'],
          _count: true,
          where: { status: 'active' },
        }),
      ]);

      // Calculate percentages and growth
      const userGrowthPercentage =
        activeUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
      const subscriptionRate =
        totalUsers > 0 ? (activeSubscriptions / totalUsers) * 100 : 0;
      const trialConversionRate =
        trialSubscriptions > 0
          ? ((activeSubscriptions - trialSubscriptions) / trialSubscriptions) *
            100
          : 0;

      return successResponse('Admin dashboard data retrieved successfully', {
        users: {
          total: totalUsers,
          active: activeUsers,
          growthPercentage: userGrowthPercentage.toFixed(2),
          byLoginProvider: usersByLoginProvider,
          recent: recentUsers,
        },
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          trial: trialSubscriptions,
          conversionRate: trialConversionRate.toFixed(2),
          subscriptionRate: subscriptionRate.toFixed(2),
          byType: subscriptionsByType,
          byPackage: packageStats,
          recent: recentSubscriptions,
        },
        wordUsage: {
          total: totalWordGeneration._sum.wordsGenerated || 0,
        },
        revenueMetrics: {
          activeSubscriptions,
          subscriptionsByType,
        },
      });
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
      return errorResponse('Failed to fetch admin dashboard data');
    }
  }

  async updateEmail(
    user: User,
    payload: {
      email: string;
    },
  ) {
    try {
      if (!payload.email) {
        return errorResponse('Email field is required!');
      }

      const checkEmailExists = await this.prisma.user.findFirst({
        where: {
          email: {
            not: {
              equals: user.email,
            },
            equals: payload.email,
          },
        },
      });

      if (checkEmailExists) {
        return errorResponse('This email has been already taken!');
      } else {
        const userDetails = await this.prisma.user.update({
          where: {
            email: user.email,
          },
          data: {
            email: payload.email,
          },
        });
        delete userDetails.password;

        return successResponse('Email is updated successfully!', userDetails);
      }
    } catch (error) {
      processException(error);
    }
  }
}
