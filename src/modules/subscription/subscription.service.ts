import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  CustomerCreatedEvent,
  CustomerUpdatedEvent,
  SubscriptionCreatedEvent,
  SubscriptionUpdatedEvent,
  SubscriptionCanceledEvent,
} from '@paddle/paddle-node-sdk';
import { PaddleUtil } from 'src/shared/utils/paddle.util';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { User } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paddleUtil: PaddleUtil,
  ) {}

  async createCheckout(
    user: User,
    priceId: string,
    redirectUrl: string,
  ): Promise<string> {
    try {
      const paddle = this.paddleUtil.getInstance();

      // Find package by priceId
      const package_ = await this.prisma.package.findUnique({
        where: { variantId: priceId },
      });

      if (!package_) {
        throw new Error('Invalid package variant');
      }

      // Create a customer in Paddle if they don't exist
      let paddleCustomerId: string;
      try {
        const customer = await paddle.customers.create({
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
        });
        paddleCustomerId = customer.id;
      } catch (error) {
        if (error.code === 'customer_already_exists') {
          // Find existing customer
          const customersResult = await paddle.customers.list({
            email: [user.email],
          });
          const customers = await customersResult.next();
          paddleCustomerId = customers?.[0]?.id;
        } else {
          throw error;
        }
      }

      // Create transaction
      const transaction = await paddle.transactions.create({
        items: [
          {
            priceId,
            quantity: 1,
          },
        ],
        customerId: paddleCustomerId,
        checkout: {
          url: redirectUrl,
        },
        customData: {
          userId: user.id,
          packageId: package_.id,
        },
      });

      return transaction.checkout.url;
    } catch (error) {
      this.logger.error('Error creating checkout:', error);
      throw error;
    }
  }

  async handleSubscriptionCreated(event: SubscriptionCreatedEvent) {
    try {
      const subscriptionData = event.data;
      const customData = subscriptionData.customData as {
        userId: string;
        packageId: string;
      };

      const nextResetDate = new Date();
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      const subscription = await this.prisma.subscription.create({
        data: {
          id: subscriptionData.id,
          status: subscriptionData.status,
          user: { connect: { id: customData.userId } },
          package: { connect: { id: customData.packageId } },
          startDate: new Date(subscriptionData.startedAt),
          endDate: new Date(subscriptionData.nextBilledAt),
          nextWordResetDate: nextResetDate,
          nextPostResetDate: nextResetDate,
          monthlyWordLimit: 0, // Set based on package
          linkedInPostLimit: 0, // Set based on package
        },
      });

      this.logger.log(`Subscription ${subscription.id} created successfully`);
      return subscription;
    } catch (error) {
      this.logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  async handleSubscriptionUpdated(event: SubscriptionUpdatedEvent) {
    try {
      const subscriptionData = event.data;

      await this.prisma.subscription.update({
        where: { id: subscriptionData.id },
        data: {
          status: subscriptionData.status,
          endDate: new Date(subscriptionData.nextBilledAt),
        },
      });

      this.logger.log(
        `Subscription ${subscriptionData.id} updated successfully`,
      );
    } catch (error) {
      this.logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  async handleSubscriptionCancelled(event: SubscriptionCanceledEvent) {
    try {
      const subscriptionData = event.data;

      await this.prisma.subscription.update({
        where: { id: subscriptionData.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      this.logger.log(
        `Subscription ${subscriptionData.id} cancelled successfully`,
      );
    } catch (error) {
      this.logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  async createTrialSubscription(userId: string): Promise<ResponseModel> {
    try {
      const trialDays = this.configService.get('TRIAL_DAYS') || 3;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDays);

      const nextResetDate = new Date();
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      await this.prisma.subscription.create({
        data: {
          status: 'active',
          isTrial: true,
          user: { connect: { id: userId } },
          startDate: new Date(),
          endDate,
          nextWordResetDate: nextResetDate,
          nextPostResetDate: nextResetDate,
          monthlyWordLimit: 3000, // Trial limit
          linkedInPostLimit: 10, // Trial limit
        },
      });

      return successResponse('Trial subscription created successfully');
    } catch (error) {
      return errorResponse('Failed to create trial subscription');
    }
  }

  async handleCustomerUpdate(
    event: CustomerCreatedEvent | CustomerUpdatedEvent,
  ) {
    try {
      const customerData = event.data;

      await this.prisma.user.update({
        where: { email: customerData.email },
        data: {
          externalId: customerData.id, // Use existing field or add to schema
        },
      });

      this.logger.log(`Customer ${customerData.id} updated successfully`);
    } catch (error) {
      this.logger.error('Error updating customer:', error);
      throw error;
    }
  }

  async checkSubscriptionResponse(user: User): Promise<ResponseModel> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
        include: { package: true },
      });

      return successResponse('Subscription status retrieved', { subscription });
    } catch (error) {
      return errorResponse('Failed to check subscription status');
    }
  }

  async getPricing(): Promise<ResponseModel> {
    try {
      const packages = await this.prisma.package.findMany({
        where: { status: 'active' },
      });
      return successResponse('Pricing retrieved successfully', { packages });
    } catch (error) {
      return errorResponse('Failed to retrieve pricing');
    }
  }

  async giveSubscription(
    email: string,
    durationInMonths: number,
  ): Promise<ResponseModel> {
    try {
      // Implementation
      return successResponse('Subscription given successfully');
    } catch (error) {
      return errorResponse('Failed to give subscription');
    }
  }

  async getAllSubscriptions(): Promise<ResponseModel> {
    try {
      const subscriptions = await this.prisma.subscription.findMany({
        include: { user: true, package: true },
      });
      return successResponse('Subscriptions retrieved successfully', {
        subscriptions,
      });
    } catch (error) {
      return errorResponse('Failed to get subscriptions');
    }
  }

  async getSubscriptionUsage(userId: string): Promise<ResponseModel> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        include: {
          package: true,
        },
      });

      if (!subscription) {
        return errorResponse('No active subscription found');
      }

      const usage = {
        words: {
          used: subscription.wordsGenerated,
          limit: subscription.monthlyWordLimit,
          nextReset: subscription.nextWordResetDate,
        },
        linkedin: {
          postsUsed: subscription.linkedInPostsUsed,
          postsLimit: subscription.linkedInPostLimit,
          nextReset: subscription.nextPostResetDate,
        },
      };

      return successResponse('Subscription usage retrieved', usage);
    } catch (error) {
      return errorResponse('Failed to get subscription usage');
    }
  }

  async getSubscriptionDetails(
    userId: string,
    subscriptionId: string,
  ): Promise<ResponseModel> {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
        },
        include: {
          package: true,
          user: {
            select: {
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!subscription) {
        return errorResponse('Subscription not found');
      }

      const paddle = this.paddleUtil.getInstance();
      const paddleSubscription = await paddle.subscriptions.get(subscriptionId);

      return successResponse('Subscription details retrieved', {
        subscription,
        paddleDetails: paddleSubscription,
      });
    } catch (error) {
      return errorResponse('Failed to get subscription details');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<ResponseModel> {
    try {
      const paddle = this.paddleUtil.getInstance();

      await paddle.subscriptions.cancel(subscriptionId, {
        effectiveFrom: 'next_billing_period',
      });

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      return successResponse('Subscription cancelled successfully');
    } catch (error) {
      return errorResponse(`Failed to cancel subscription: ${error.message}`);
    }
  }
}
