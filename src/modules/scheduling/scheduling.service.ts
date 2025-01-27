import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ContentPostingService } from '../content-posting/content-posting.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import chalk from 'chalk';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentPostingService: ContentPostingService,
  ) {}

  private async isUserSubscriptionActive(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return subscription?.endDate > new Date();
  }

  private getTimeInTimezone(timezone: string): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    try {
      console.log(
        chalk.blue('\n[Scheduling Service]'),
        chalk.yellow('Checking for scheduled posts...'),
        new Date().toISOString(),
      );

      // Get all scheduled posts with their profiles
      const scheduledPosts = await this.prisma.linkedInPost.findMany({
        where: {
          status: coreConstant.POST_STATUS.SCHEDULED,
        },
        include: {
          linkedInProfile: true,
          user: true,
        },
      });

      if (scheduledPosts.length === 0) {
        console.log(
          chalk.blue('[Scheduling Service]'),
          chalk.gray('No scheduled posts found'),
        );
        return;
      }

      // Filter posts that should be published based on their timezone
      const postsToPublish = scheduledPosts.filter((post) => {
        const profileTimezone = post.linkedInProfile.timezone || 'UTC';
        const timeInProfileZone = this.getTimeInTimezone(profileTimezone);
        const scheduledTime = new Date(post.scheduledTime);

        console.log(
          chalk.blue('[Scheduling Service]'),
          chalk.yellow(`Post ${post.id} scheduling info:`),
          '\n',
          chalk.gray('├─'),
          chalk.cyan(`Profile Timezone: ${profileTimezone}`),
          '\n',
          chalk.gray('├─'),
          chalk.cyan(
            `Current Time in Profile's Timezone: ${timeInProfileZone.toISOString()}`,
          ),
          '\n',
          chalk.gray('└─'),
          chalk.cyan(`Scheduled Time: ${scheduledTime.toISOString()}`),
        );

        return scheduledTime <= timeInProfileZone;
      });

      if (postsToPublish.length === 0) {
        console.log(
          chalk.blue('[Scheduling Service]'),
          chalk.gray('No posts ready for publishing at this time'),
        );
        return;
      }

      console.log(
        chalk.blue('[Scheduling Service]'),
        chalk.green(`Found ${postsToPublish.length} posts to publish`),
      );

      for (const post of postsToPublish) {
        console.log(
          chalk.blue('[Scheduling Service]'),
          chalk.yellow(`Processing post ID: ${post.id}`),
          chalk.gray(`(LinkedIn Profile: ${post.linkedInProfile.name})`),
        );

        // Check subscription status before posting
        const isSubscriptionActive = await this.isUserSubscriptionActive(
          post.userId,
        );

        if (!isSubscriptionActive) {
          await this.prisma.$transaction(async (prisma) => {
            await prisma.linkedInPost.update({
              where: { id: post.id },
              data: {
                status: coreConstant.POST_STATUS.FAILED,
              },
            });

            await prisma.postLog.create({
              data: {
                linkedInPostId: post.id,
                status: coreConstant.POST_LOG_STATUS.FAILED,
                message: 'Post failed: User subscription is not active',
              },
            });
          });

          console.error(
            chalk.blue('[Scheduling Service]'),
            chalk.red(`✗ Skipped post ID: ${post.id}`),
            chalk.red('Error: User subscription is not active'),
          );
          continue;
        }

        try {
          await this.contentPostingService.postNow(post.userId, post.id);
        } catch (error) {
          await this.prisma.$transaction(async (prisma) => {
            await prisma.linkedInPost.update({
              where: { id: post.id },
              data: {
                status: coreConstant.POST_STATUS.FAILED,
              },
            });

            await prisma.postLog.create({
              data: {
                linkedInPostId: post.id,
                status: coreConstant.POST_LOG_STATUS.FAILED,
                message: `Error publishing scheduled post: ${error.message}`,
              },
            });
          });

          console.error(
            chalk.blue('[Scheduling Service]'),
            chalk.red(`✗ Failed to publish post ID: ${post.id}`),
            chalk.red(`Error: ${error.message}`),
          );
        }
      }

      console.log(
        chalk.blue('[Scheduling Service]'),
        chalk.green('Finished processing scheduled posts'),
        chalk.gray(new Date().toISOString()),
      );
    } catch (error) {
      console.error(
        chalk.blue('[Scheduling Service]'),
        chalk.red('Error processing scheduled posts:'),
        chalk.red(error.stack || error.message),
      );
    }
  }

  async getPendingScheduledPosts(hours: number = 24): Promise<any> {
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      // Get all users with active subscriptions
      const activeSubscriptions = await this.prisma.subscription.findMany({
        where: {
          endDate: {
            gt: now,
          },
        },
        select: {
          userId: true,
        },
      });

      const activeUserIds = activeSubscriptions.map((sub) => sub.userId);

      const pendingPosts = await this.prisma.linkedInPost.findMany({
        where: {
          status: coreConstant.POST_STATUS.SCHEDULED,
          scheduledTime: {
            gte: now,
            lte: futureTime,
          },
          userId: {
            in: activeUserIds,
          },
        },
        include: {
          user: {
            select: {
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          linkedInProfile: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          scheduledTime: 'asc',
        },
      });

      console.log(
        chalk.blue('\n[Scheduling Service]'),
        chalk.yellow(`Pending posts for next ${hours} hours:`),
      );

      if (pendingPosts.length === 0) {
        console.log(
          chalk.blue('[Scheduling Service]'),
          chalk.gray('No pending scheduled posts found'),
        );
        return [];
      }

      pendingPosts.forEach((post) => {
        const timeUntilPublish =
          new Date(post.scheduledTime).getTime() - now.getTime();
        const hoursUntil = Math.floor(timeUntilPublish / (1000 * 60 * 60));
        const minutesUntil = Math.floor(
          (timeUntilPublish % (1000 * 60 * 60)) / (1000 * 60),
        );

        console.log(
          chalk.blue('\n[Scheduled Post]'),
          chalk.white(`ID: ${post.id}`),
          '\n',
          chalk.gray('├─'),
          chalk.yellow(
            `Scheduled for: ${new Date(post.scheduledTime).toLocaleString()}`,
          ),
          '\n',
          chalk.gray('├─'),
          chalk.cyan(`Time until publish: ${hoursUntil}h ${minutesUntil}m`),
          '\n',
          chalk.gray('├─'),
          chalk.green(`LinkedIn Profile: ${post.linkedInProfile.name}`),
          '\n',
          chalk.gray('├─'),
          chalk.magenta(`User: ${post.user.first_name} ${post.user.last_name}`),
          '\n',
          chalk.gray('└─'),
          chalk.white(`Content: ${post.content.substring(0, 100)}...`),
        );
      });

      return pendingPosts;
    } catch (error) {
      console.error(
        chalk.blue('[Scheduling Service]'),
        chalk.red('Error fetching pending posts:'),
        chalk.red(error.stack || error.message),
      );
      return [];
    }
  }
}
