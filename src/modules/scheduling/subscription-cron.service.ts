import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionTasks() {
    this.logger.log('Running subscription maintenance tasks...');

    await Promise.all([
      this.handleExpiredSubscriptions(),
      this.handleWordUsageResets(),
      this.handleLinkedInPostResets(),
      this.handleCarouselResets(),
    ]);
  }

  private async handleExpiredSubscriptions() {
    try {
      const now = new Date();

      const expiredSubscriptions = await this.prisma.subscription.updateMany({
        where: {
          endDate: {
            lt: now,
          },
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
        },
        data: {
          status: coreConstant.SUBSCRIPTION_STATUS.EXPIRED,
        },
      });

      this.logger.log(
        `Updated ${expiredSubscriptions.count} expired subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error handling expired subscriptions:', error);
    }
  }

  private async handleWordUsageResets() {
    try {
      const now = new Date();

      const subscriptionsToReset = await this.prisma.subscription.updateMany({
        where: {
          nextWordResetDate: {
            lt: now,
          },
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
        },
        data: {
          wordsGenerated: 0,
          nextWordResetDate: {
            set: new Date(now.getFullYear(), now.getMonth() + 1, 1), // First day of next month
          },
        },
      });

      this.logger.log(
        `Reset word usage for ${subscriptionsToReset.count} subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error handling word usage resets:', error);
    }
  }

  private async handleLinkedInPostResets() {
    try {
      const now = new Date();

      const subscriptionsToReset = await this.prisma.subscription.updateMany({
        where: {
          nextPostResetDate: {
            lt: now,
          },
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
        },
        data: {
          linkedInPostsUsed: 0,
          nextPostResetDate: {
            set: new Date(now.getFullYear(), now.getMonth() + 1, 1), // First day of next month
          },
        },
      });

      this.logger.log(
        `Reset LinkedIn post counts for ${subscriptionsToReset.count} subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error handling LinkedIn post resets:', error);
    }
  }

  private async handleCarouselResets() {
    try {
      const now = new Date();

      const subscriptionsToReset = await this.prisma.subscription.updateMany({
        where: {
          nextCarouselResetDate: {
            lt: now,
          },
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
        },
        data: {
          carouselsGenerated: 0,
          nextCarouselResetDate: {
            set: new Date(now.getFullYear(), now.getMonth() + 1, 1), // First day of next month
          },
        },
      });

      this.logger.log(
        `Reset carousel counts for ${subscriptionsToReset.count} subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error handling carousel resets:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleTrialSubscriptions() {
    try {
      const now = new Date();

      // Find trial subscriptions that have expired
      const expiredTrials = await this.prisma.subscription.updateMany({
        where: {
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
          endDate: {
            lt: now,
          },
        },
        data: {
          status: coreConstant.SUBSCRIPTION_STATUS.EXPIRED,
        },
      });

      this.logger.log(
        `Updated ${expiredTrials.count} expired trial subscriptions`,
      );
    } catch (error) {
      this.logger.error('Error handling trial subscriptions:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async sendExpirationNotifications() {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const expiringSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
          endDate: {
            gte: new Date(),
            lt: threeDaysFromNow,
          },
        },
        include: {
          user: {
            select: {
              email: true,
              first_name: true,
            },
          },
        },
      });

      // TODO: Implement notification service
      this.logger.log(
        `Found ${expiringSubscriptions.length} subscriptions expiring soon`,
      );
    } catch (error) {
      this.logger.error('Error sending expiration notifications:', error);
    }
  }
}
