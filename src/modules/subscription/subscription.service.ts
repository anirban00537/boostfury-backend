import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { User, Package, Subscription } from '@prisma/client';
import { ResponseModel } from 'src/shared/models/response.model';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import axios from 'axios';
import { coreConstant } from 'src/shared/helpers/coreConstant';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
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

      const isActive = subscription?.status === coreConstant.SUBSCRIPTION_STATUS.ACTIVE;

      // Get usage data for different features
      const usageData = {
        words: {
          used: subscription?.wordsGenerated || 0,
          limit: subscription?.monthlyWordLimit || 0,
          nextReset: subscription?.nextWordResetDate,
        },
        linkedin: {
          accountsUsed: subscription?.linkedInAccountsUsed || 0,
          accountsLimit: subscription?.linkedInAccountLimit || 0,
          postsUsed: subscription?.linkedInPostsUsed || 0,
          postsLimit: subscription?.linkedInPostLimit || 0,
          nextReset: subscription?.nextPostResetDate,
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
              features: {
                viralPostGeneration: subscription.package.viralPostGeneration,
                aiStudio: subscription.package.aiStudio,
                postIdeaGenerator: subscription.package.postIdeaGenerator,
              },
            }
          : null,
        usage: usageData,
      });
    } catch (error) {
      this.logger.error(`Error checking subscription: ${error.message}`);
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
      throw new HttpException(
        `Failed to create checkout: ${error.response?.data?.errors?.[0]?.detail || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

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
          nextPostResetDate: nextResetDate,
          monthlyWordLimit: proPackage.monthlyWordLimit,
          linkedInAccountLimit: proPackage.linkedInAccountLimit,
          linkedInPostLimit: proPackage.linkedInPostLimit,
          viralPostGeneration: proPackage.viralPostGeneration,
          aiStudio: proPackage.aiStudio,
          postIdeaGenerator: proPackage.postIdeaGenerator,
          billingCycle: 'monthly',
          currency: proPackage.currency,
        },
        update: {
          packageId: proPackage.id,
          status: 'active',
          endDate,
          monthlyWordLimit: proPackage.monthlyWordLimit,
          linkedInAccountLimit: proPackage.linkedInAccountLimit,
          linkedInPostLimit: proPackage.linkedInPostLimit,
          viralPostGeneration: proPackage.viralPostGeneration,
          aiStudio: proPackage.aiStudio,
          postIdeaGenerator: proPackage.postIdeaGenerator,
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
          linkedin: {
            accountsUsed: sub.linkedInAccountsUsed,
            accountsLimit: sub.linkedInAccountLimit,
            postsUsed: sub.linkedInPostsUsed,
            postsLimit: sub.linkedInPostLimit,
          },
         
        },
        daysRemaining: Math.ceil(
          (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      }));

      return successResponse('Subscriptions retrieved successfully', {
        subscriptions: formattedSubscriptions,
        total: formattedSubscriptions.length,
        activeSubscriptions: formattedSubscriptions.filter((s) => s.isActive)
          .length,
      });
    } catch (error) {
      return errorResponse(`Failed to get subscriptions: ${error.message}`);
    }
  }

  async handleOrderCreated(evt: any) {
    console.log('Processing order created event');
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.userId;
      const packageId = customData.packageId;

      if (!userId || !packageId) {
        throw new Error('Missing userId or packageId in custom_data');
      }

      const package_ = await this.prisma.package.findUnique({
        where: { id: packageId },
      });

      if (!package_) {
        throw new Error(`Package not found with ID: ${packageId}`);
      }

      const isSuccessful = evt.data.attributes.status === 'paid';
      const orderCreatedAt = new Date(evt.data.attributes.created_at);
      const firstOrderItem = evt.data.attributes.first_order_item;

      if (!firstOrderItem) {
        throw new Error('No order items found in webhook data');
      }

      const variantName = firstOrderItem.variant_name.toLowerCase();
      const subscriptionLengthInMonths =
        variantName.includes('yearly') || variantName.includes('annual')
          ? 12
          : 1;

      const startDate = new Date(orderCreatedAt);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + subscriptionLengthInMonths);

      const nextResetDate = new Date(startDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          packageId,
          orderId: evt.data.id,
          status: isSuccessful ? 'active' : 'pending',
          startDate,
          endDate,
          nextWordResetDate: nextResetDate,
          nextPostResetDate: nextResetDate,
          monthlyWordLimit: package_.monthlyWordLimit,
          linkedInAccountLimit: package_.linkedInAccountLimit,
          linkedInPostLimit: package_.linkedInPostLimit,
          viralPostGeneration: package_.viralPostGeneration,
          aiStudio: package_.aiStudio,
          postIdeaGenerator: package_.postIdeaGenerator,
          billingCycle:
            subscriptionLengthInMonths === 12 ? 'yearly' : 'monthly',
          currency: evt.data.attributes.currency,
          renewalPrice: parseFloat(evt.data.attributes.total),
          wordsGenerated: 0,
          linkedInAccountsUsed: 0,
          linkedInPostsUsed: 0,
        },
      });
      console.log(subscription, 'subscription created');

      console.log('Subscription created successfully');
    } catch (error) {
      this.logger.error('Error in handleOrderCreated:', {
        message: error.message,
        stack: error.stack,
        eventData: evt,
      });
      throw error;
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
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updateData: any = {
        status: evt.data.attributes.status,
      };

      if (packageId && packageId !== subscription.packageId) {
        const newPackage = await this.prisma.package.findUnique({
          where: { id: packageId },
        });

        if (newPackage) {
          Object.assign(updateData, {
            packageId,
            monthlyWordLimit: newPackage.monthlyWordLimit,
            linkedInAccountLimit: newPackage.linkedInAccountLimit,
            linkedInPostLimit: newPackage.linkedInPostLimit,
            viralPostGeneration: newPackage.viralPostGeneration,
            aiStudio: newPackage.aiStudio,
            postIdeaGenerator: newPackage.postIdeaGenerator,
          });
        }
      }

      await this.prisma.subscription.update({
        where: { userId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error('Error handling subscription update:', error);
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
      this.logger.error('Error handling subscription cancellation:', error);
      throw error;
    }
  }

  async createTrialSubscription(userId: string): Promise<ResponseModel> {
    try {
      const now = new Date();
      const trialDays = this.configService.get('TRIAL_DAYS') || 3;
      const expirationDate = new Date(
        now.getTime() + trialDays * 24 * 60 * 60 * 1000,
      );

      // Get trial package - using the known ID
      const trialPackage = await this.prisma.package.findUnique({
        where: { id: coreConstant.PACKAGE_TYPE.TRIAL },
      });

      if (!trialPackage) {
        console.log('Trial package not found');
        return errorResponse('Trial package not found');
      }

      // Create subscription with trial settings
      const subscription = await this.prisma.subscription.create({
        data: {
          user: {
            connect: { id: userId },
          },
          package: {
            connect: { id: 'trial' }, // Using the fixed ID
          },
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
          monthlyWordLimit: trialPackage.monthlyWordLimit,
          wordsGenerated: 0,
          linkedInPostsUsed: 0,
          endDate: expirationDate,
          lastWordResetDate: now,
          nextWordResetDate: expirationDate,
          nextPostResetDate: expirationDate,
          isTrial: true, // Mark as trial subscription
        },
      });

      // Create initial token log
      await this.prisma.wordTokenLog.create({
        data: {
          subscription: {
            connect: { id: subscription.id },
          },
          amount: trialPackage.monthlyWordLimit,
          type: coreConstant.WORD_TOKEN_LOG_TYPE.RESET,
          description: `Trial subscription activation with ${trialPackage.monthlyWordLimit} words`,
          source: coreConstant.PACKAGE_TYPE.TRIAL,
        },
      });

      console.log(`Trial subscription created for user ${userId}`);
      return successResponse(
        'Trial subscription created successfully',
        subscription,
      );
    } catch (error) {
      this.logger.error('Error creating trial subscription:', error);
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

          // LinkedIn Limits
          linkedInAccountLimit: true,
          linkedInPostLimit: true,
          linkedInImageLimit: true,
          linkedInVideoLimit: true,

          // Features
          viralPostGeneration: true,
          aiStudio: true,
          postIdeaGenerator: true,

          // Additional Features
          additionalFeatures: true,
        },
      });

      const formattedPackages = packages.map((pkg) => ({
        ...pkg,
        features: {
          wordGeneration: {
            limit: pkg.monthlyWordLimit,
            description: `${pkg.monthlyWordLimit.toLocaleString()} words per month`,
          },
          linkedin: {
            accounts: {
              limit: pkg.linkedInAccountLimit,
              description: `${pkg.linkedInAccountLimit} LinkedIn ${pkg.linkedInAccountLimit === 1 ? 'account' : 'accounts'}`,
            },
            posts: {
              limit: pkg.linkedInPostLimit,
              description: `${pkg.linkedInPostLimit} posts per month`,
            },
            media: {
              images: pkg.linkedInImageLimit,
              videos: pkg.linkedInVideoLimit,
            },
          },
        
          core: [
            pkg.viralPostGeneration && 'Viral Post Generation',
            pkg.aiStudio && 'AI Studio',
            pkg.postIdeaGenerator && 'Post Idea Generator',
          ].filter(Boolean),
          additional: Object.entries(pkg.additionalFeatures || {})
            .filter(([_, value]) => value === true)
            .map(([key]) =>
              key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase()),
            ),
        },
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
      this.logger.error('Error retrieving pricing:', error);
      return errorResponse('Failed to retrieve pricing information');
    }
  }

  async handleSubscriptionCreated(evt: any): Promise<any> {
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.userId;
      const packageId = customData.packageId;

      console.log('\nSubscription Data:', {
        userId,
        packageId,
        orderId: evt.data.attributes.order_id,
        status: evt.data.attributes.status,
      });

      // Find the package first
      const package_ = await this.prisma.package.findUnique({
        where: { id: packageId },
      });

      if (!package_) {
        console.error('❌ Package not found:', packageId);
        throw new Error(`Package not found with ID: ${packageId}`);
      }

      console.log('\nPackage found:', {
        id: package_.id,
        name: package_.name,
        type: package_.type,
      });

      // Find existing subscription
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      const subscriptionData = evt.data.attributes;
      const startDate = new Date(subscriptionData.created_at);
      const renewalDate = new Date(subscriptionData.renews_at);
      const nextResetDate = new Date(startDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);

      const subscriptionDetails = {
        orderId: subscriptionData.order_id.toString(),
        status: subscriptionData.status,
        startDate,
        endDate: renewalDate,
        nextWordResetDate: nextResetDate,
        nextPostResetDate: nextResetDate,
        nextCarouselResetDate: nextResetDate,
        monthlyWordLimit: package_.monthlyWordLimit,
        linkedInAccountLimit: package_.linkedInAccountLimit,
        linkedInPostLimit: package_.linkedInPostLimit,
        viralPostGeneration: package_.viralPostGeneration,
        aiStudio: package_.aiStudio,
        postIdeaGenerator: package_.postIdeaGenerator,
        billingCycle: subscriptionData.variant_name.toLowerCase().includes('yearly') 
          ? 'yearly' 
          : 'monthly',
        currency: 'USD',
        renewalPrice: parseFloat(subscriptionData.first_subscription_item?.price_id) || 0,
        wordsGenerated: 0,
        linkedInAccountsUsed: 0,
        linkedInPostsUsed: 0,
        carouselsGenerated: 0,
        isTrial: false,
      };

      let subscription;
      
      if (existingSubscription) {
        console.log('\nUpdating existing subscription:', existingSubscription.id);
        
        subscription = await this.prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            ...subscriptionDetails,
            package: {
              connect: { id: packageId }
            }
          },
        });
      } else {
        console.log('\nCreating new subscription');
        
        subscription = await this.prisma.subscription.create({
          data: {
            ...subscriptionDetails,
            user: {
              connect: { id: userId }
            },
            package: {
              connect: { id: packageId }
            }
          },
        });
      }

      console.log('\n✅ Subscription processed successfully:', {
        id: subscription.id,
        userId: subscription.userId,
        status: subscription.status,
        endDate: subscription.endDate,
      });

      return successResponse(
        `Subscription ${existingSubscription ? 'updated' : 'created'} successfully`, 
        subscription
      );
    } catch (error) {
      console.error('\n❌ Error in handleSubscriptionCreated:', {
        message: error.message,
        stack: error.stack,
      });
      console.error('Event data:', JSON.stringify(evt, null, 2));
      return errorResponse(`Failed to process subscription: ${error.message}`);
    }
  }
}
