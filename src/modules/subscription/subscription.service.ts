import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { User, Package, Subscription } from '@prisma/client';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import axios from 'axios';
import { coreConstant } from 'src/shared/helpers/coreConstant';

@Injectable()
export class SubscriptionService {
  private readonly apiKey: string;
  private readonly storeId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('LEMONSQUEEZY_API_KEY');
    this.storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
  }

  async checkSubscriptionResponse(user: User): Promise<ResponseModel> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
        include: { package: true },
      });

      const isActive =
        subscription?.status === coreConstant.SUBSCRIPTION_STATUS.ACTIVE;

      // Get usage data for different features
      const usageData = {
        words: {
          used: subscription?.wordsGenerated || 0,
          limit: subscription?.monthlyWordLimit || 0,
          nextReset: subscription?.nextWordResetDate,
        },
      };

      return successResponse('Subscription status retrieved', {
        isActive,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              isTrial: subscription.isTrial,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
              package: subscription.package
                ? {
                    name: subscription.package.name,
                    type: subscription.package.type,
                  }
                : null,
              subscriptionId: subscription.subscriptionId,
            }
          : null,
        usage: usageData,
      });
    } catch (error) {
      console.error(`Error checking subscription: ${error.message}`);
      return errorResponse('Failed to check subscription status');
    }
  }

  async createCheckout(
    user: User,
    variantId: string,
    redirectUrl: string,
  ): Promise<string> {
    try {
      // Find package by variantId
      const package_ = await this.prisma.package.findUnique({
        where: { variantId },
      });

      if (!package_) {
        throw new HttpException(
          'Invalid package variant',
          HttpStatus.BAD_REQUEST,
        );
      }

      const payload = {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              custom: {
                userId: user.id,
                packageId: package_.id,
              },
            },
            product_options: {
              redirect_url: redirectUrl,
              receipt_button_text: 'Return to Dashboard',
              receipt_link_url: redirectUrl,
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: this.storeId,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: variantId,
              },
            },
          },
        },
      };

      const checkoutResponse = await axios.post(
        'https://api.lemonsqueezy.com/v1/checkouts',
        payload,
        {
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      return checkoutResponse.data.data.attributes.url;
    } catch (error) {
      console.log('Error response from LemonSqueezy API:', error.response.data);
      throw new HttpException(
        `Failed to create checkout: ${error.response?.data?.errors?.[0]?.detail || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async handleSubscriptionUpdated(evt: any) {
    console.log('Processing subscription updated event');
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.userId;
      const packageId = customData.packageId;

      if (!userId) {
        throw new Error('No userId found in custom_data');
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        include: {
          package: true
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const subscriptionData = evt.data.attributes;
      
      // Validate and parse dates
      if (!subscriptionData.created_at) {
        throw new Error('Missing created_at in subscription data');
      }
      const startDate = new Date(subscriptionData.created_at);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid created_at date format');
      }

      // Get the end date from renews_at
      let endDate: Date | null = null;
      if (subscriptionData.renews_at) {
        endDate = new Date(subscriptionData.renews_at);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid renews_at date format');
        }
        // Ensure end date is after start date
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }

      // Calculate next reset date (always one month from start, but never after end date)
      const nextResetDate = new Date(startDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      if (endDate && nextResetDate > endDate) {
        nextResetDate.setTime(endDate.getTime());
      }

      const updateData: any = {
        status: subscriptionData.status,
        startDate,
        endDate,
        nextWordResetDate: nextResetDate,
        lastWordResetDate: startDate, // Reset the last word reset date to start date
        renewalPrice: subscriptionData.first_subscription_item?.price || 0,
        subscriptionId: evt.data.id,
        orderId: subscriptionData.order_id?.toString(),
        billingCycle: subscription.package?.type || 'monthly',
        isTrial: false, // Since this is an update from LemonSqueezy, it's not a trial
        wordsGenerated: 0, // Reset words generated count
      };

      if (packageId && packageId !== subscription.packageId) {
        const newPackage = await this.prisma.package.findUnique({
          where: { id: packageId },
        });

        if (newPackage) {
          Object.assign(updateData, {
            packageId,
            monthlyWordLimit: newPackage.monthlyWordLimit,
            billingCycle: newPackage.type,
            features: newPackage.features || [],
          });
        }
      }

      console.log('Updating subscription with data:', updateData);

      const updatedSubscription = await this.prisma.subscription.update({
        where: { userId },
        data: updateData,
        include: {
          package: true
        }
      });

      console.log(`Updated subscription for user ${userId}:`, {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        startDate: updatedSubscription.startDate,
        endDate: updatedSubscription.endDate,
        nextWordResetDate: updatedSubscription.nextWordResetDate,
        monthlyWordLimit: updatedSubscription.monthlyWordLimit,
        package: updatedSubscription.package?.name
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error handling subscription update:', error);
      throw error;
    }
  }

  async handleSubscriptionCancelled(evt: any) {
    console.log('Processing subscription cancelled event');
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.userId;

      if (!userId) {
        throw new Error('No userId found in custom_data');
      }

      await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error handling subscription cancellation:', error);
      throw error;
    }
  }

  async createTrialSubscription(userId: string): Promise<ResponseModel> {
    try {
      // Get trial package - using the known ID
      const trialPackage = await this.prisma.package.findFirst({
        where: {
          type: coreConstant.PACKAGE_TYPE.TRIAL,
          status: coreConstant.PACKAGE_STATUS.ACTIVE,
        },
      });

      if (!trialPackage) {
        console.log('Trial package not found');
        return errorResponse('Trial package not found');
      }

      // Check if the user already has a subscription, which means trial has already been used
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });
      if (existingSubscription) {
        return errorResponse(
          'User already has a subscription. Trial cannot be granted again.',
        );
      }

      const now = new Date();
      const trialDays = trialPackage.trial_duration_days || 3;
      const expirationDate = new Date(
        now.getTime() + trialDays * 24 * 60 * 60 * 1000,
      );

      // Wrap subscription and token log creation in a transaction to ensure both succeed or fail together
      const subscription = await this.prisma.$transaction(async (tx) => {
        const trialSubscription = await tx.subscription.create({
          data: {
            user: { connect: { id: userId } },
            package: { connect: { id: trialPackage.id } },
            status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
            monthlyWordLimit: trialPackage.monthlyWordLimit,
            wordsGenerated: 0,
            endDate: expirationDate,
            lastWordResetDate: now,
            nextWordResetDate: expirationDate,
            isTrial: true, // Mark as trial subscription
            trialUsed: true, // Ensure trial is marked as used
          },
        });

        // Create initial token log
        await tx.wordTokenLog.create({
          data: {
            subscription: { connect: { id: trialSubscription.id } },
            amount: trialPackage.monthlyWordLimit,
            type: coreConstant.WORD_TOKEN_LOG_TYPE.RESET,
            description: `Trial subscription activation with ${trialPackage.monthlyWordLimit} words`,
            source: coreConstant.PACKAGE_TYPE.MONTHLY,
          },
        });

        return trialSubscription;
      });

      console.log(`Trial subscription created for user ${userId}`);
      return successResponse(
        'Trial subscription created successfully',
        subscription,
      );
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      return errorResponse('Failed to create trial subscription');
    }
  }

  async getPricing(): Promise<ResponseModel> {
    try {
      const packages = await this.prisma.package.findMany({
        where: {
          status: 'active',
          type: {
            not: coreConstant.PACKAGE_TYPE.TRIAL, // Exclude trial package
          },
        },
        orderBy: {
          price: 'asc',
        },

        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          price: true,
          currency: true,
          variantId: true,

          // Word Generation Limits
          monthlyWordLimit: true,

          // Additional Features
          featuresList: true,
          features: true,
        },
      });

      const formattedPackages = packages.map((pkg) => ({
        ...pkg,
        features: {
          wordGeneration: {
            limit: pkg.monthlyWordLimit,
            description: `${pkg.monthlyWordLimit.toLocaleString()} Ai words per month`,
          },
          features: pkg.featuresList,
        },
        description: pkg.description,
        billing: {
          price: pkg.price,
          currency: pkg.currency,
          interval: pkg.type,
          variantId: pkg.variantId,
        },
      }));

      // Group packages by type (monthly/yearly)
      const groupedPackages = {
        monthly: formattedPackages.filter((pkg) => pkg.type === 'monthly'),
        yearly: formattedPackages.filter((pkg) => pkg.type === 'yearly'),
      };

      return successResponse('Pricing retrieved successfully', {
        packages: groupedPackages,
        currencies: [...new Set(packages.map((pkg) => pkg.currency))],
      });
    } catch (error) {
      console.error('Error retrieving pricing:', error);
      return errorResponse('Failed to retrieve pricing information');
    }
  }

  async handleSubscriptionPaymentSuccess(evt: any): Promise<any> {
    try {
      // Extract relevant data from the webhook payload
      const { userId, packageId } = evt.meta.custom_data || {};
      const { status, subscription_id, total_usd } = evt.data.attributes;

      if (!userId || !packageId || !subscription_id) {
        throw new Error('Missing required data in the event payload');
      }

      // Log payment event details for debugging
      console.log(`Received payment success event for userId: ${userId}`);
      console.log(`Payment status: ${status}, Amount: ${total_usd} USD`);

      // Find the existing subscription based on userId and subscription_id
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        throw new Error(`Subscription not found for userId: ${userId}`);
      }

      // Only mark the subscription as active if the payment was successful
      if (status === 'paid') {
        const updatedSubscription = await this.prisma.subscription.update({
          where: { userId },
          data: {
            status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
            subscriptionId: String(subscription_id), // Store subscription_id from payment event
          },
        });

        console.log(`Subscription for userId ${userId} marked as active`);

        return successResponse(
          'Subscription activated successfully',
          updatedSubscription,
        );
      } else {
        throw new Error(`Payment failed for subscription: ${subscription_id}`);
      }
    } catch (error) {
      console.error(
        'Error processing subscription payment success:',
        error,
      );
      return errorResponse(
        `Failed to process payment success: ${error.message}`,
      );
    }
  }

  async handleSubscriptionCreated(evt: any): Promise<any> {
    try {
      const { userId, packageId } = evt.meta.custom_data || {};
      if (!userId || !packageId) {
        throw new Error('Missing userId or packageId in custom data');
      }

      console.log(evt.data.id, 'Received event data for subscription creation');

      const package_ = await this.prisma.package.findUnique({
        where: { id: packageId },
      });
      if (!package_) {
        throw new Error(`Package not found with ID: ${packageId}`);
      }

      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      const subscriptionData = evt.data.attributes;
      
      // Validate and parse the creation date
      if (!subscriptionData.created_at) {
        throw new Error('Missing created_at in subscription data');
      }
      const startDate = new Date(subscriptionData.created_at);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid created_at date format');
      }

      // Validate and parse the renewal date if present
      let endDate: Date;
      if (subscriptionData.renews_at) {
        endDate = new Date(subscriptionData.renews_at);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid renews_at date format');
        }
        // Ensure end date is after start date
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      } else {
        endDate = new Date(startDate);
        if (package_.type === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (package_.type === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          // For lifetime or other types, set a far future date
          endDate.setFullYear(endDate.getFullYear() + 100);
        }
      }

      // Calculate next reset date (always one month from start, but never after end date)
      const nextResetDate = new Date(startDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      if (nextResetDate > endDate) {
        nextResetDate.setTime(endDate.getTime());
      }

      const subscriptionDetails = {
        orderId: subscriptionData.order_id?.toString(),
        status: coreConstant.SUBSCRIPTION_STATUS.PENDING,
        startDate,
        endDate,
        nextWordResetDate: nextResetDate,
        nextPostResetDate: nextResetDate,
        monthlyWordLimit: package_.monthlyWordLimit,
        billingCycle: package_.type,
        currency: 'USD',
        renewalPrice: subscriptionData.first_subscription_item?.price || 0,
        wordsGenerated: 0,
        linkedInAccountsUsed: 0,
        linkedInPostsUsed: 0,
        isTrial: false,
        subscriptionId: evt.data.id,
      };

      let subscription;
      if (existingSubscription) {
        console.log('Updating existing subscription:', existingSubscription.id);
        subscription = await this.prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            ...subscriptionDetails,
            package: { connect: { id: packageId } },
          },
        });
      } else {
        console.log('Creating new subscription');
        subscription = await this.prisma.subscription.create({
          data: {
            ...subscriptionDetails,
            user: { connect: { id: userId } },
            package: { connect: { id: packageId } },
          },
        });
      }

      console.log('Subscription created with status pending:', subscription.id);
      return successResponse(
        `Subscription ${existingSubscription ? 'updated' : 'created'} successfully`,
        subscription,
      );
    } catch (error) {
      console.error('Error processing subscription creation:', error);
      return errorResponse(`Failed to process subscription: ${error.message}`);
    }
  }

  async handleSubscriptionExpired(evt: any): Promise<any> {
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.userId;

      if (!userId) {
        throw new Error('No userId found in custom_data');
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Log the event for debugging purposes
      console.log(`Processing expired subscription for userId: ${userId}`);

      // Update the subscription status to "expired"
      const updatedSubscription = await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: coreConstant.SUBSCRIPTION_STATUS.EXPIRED,
          endDate: new Date(),
        },
      });

      console.log(
        `Subscription for userId ${userId} marked as expired successfully`,
      );

      // Return a success response with the updated subscription
      return successResponse(
        'Subscription expired successfully',
        updatedSubscription,
      );
    } catch (error) {
      console.error('Error handling expired subscription event:', error);
      return errorResponse(
        `Failed to process expired subscription: ${error.message}`,
      );
    }
  }

  async cancelSubscription(userId: string): Promise<ResponseModel> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        return errorResponse('No active subscription found');
      }

      if (subscription.status === 'cancelled') {
        return errorResponse('Subscription is already cancelled');
      }

      console.log(
        'Attempting to cancel subscription with ID:',
        subscription.subscriptionId,
      );
      console.log('Subscription ID:', subscription.subscriptionId);
      // Call Lemon Squeezy API to cancel the subscription
      const response = await axios.delete(
        `https://api.lemonsqueezy.com/v1/subscriptions/${subscription.subscriptionId}`,
        {
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      console.log('Subscription cancelled:', response.data);

      // Update the subscription status in the database
      const updatedSubscription = await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      });

      return successResponse('Subscription cancelled successfully', {
        subscription: updatedSubscription,
      });
    } catch (error) {
      console.log('Error response from LemonSqueezy API:', error.response.data);
      console.error('Error cancelling subscription:', error);
      return errorResponse(`Failed to cancel subscription: ${error.message}`);
    }
  }
}
