import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { IS_SUBSCRIBED_KEY } from '../decorators/is-subscribed.decorator';
import { coreConstant } from '../helpers/coreConstant';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSubscribed = this.reflector.getAllAndOverride<boolean>(
      IS_SUBSCRIBED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isSubscribed) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
        include: { package: true },
      });
      console.log(subscription.status, 'subscription.status');

      if (!subscription) {
        throw new UnauthorizedException('No active subscription found');
      }

      const now = new Date();

      // Check if subscription is expired
      if (subscription.status === coreConstant.SUBSCRIPTION_STATUS.EXPIRED) {
        throw new UnauthorizedException(
          'Subscription has expired. Please renew to continue.',
        );
      }

      // Check regular subscription
      if (subscription.status === coreConstant.SUBSCRIPTION_STATUS.ACTIVE) {
        if (subscription.endDate <= now) {
          // Update subscription status to expired
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: coreConstant.SUBSCRIPTION_STATUS.EXPIRED },
          });
          throw new UnauthorizedException(
            'Subscription has expired. Please renew to continue.',
          );
        }

        if (subscription.package.status !== 'active') {
          throw new UnauthorizedException(
            'Package is no longer available. Please contact support.',
          );
        }

        return true;
      }
      // Handle other subscription statuses
      switch (subscription.status) {
        case coreConstant.SUBSCRIPTION_STATUS.EXPIRED:
          throw new UnauthorizedException(
            'Subscription has expired. Please renew to continue.',
          );
        case coreConstant.SUBSCRIPTION_STATUS.CANCELLED:
          throw new UnauthorizedException(
            'Subscription has been cancelled. Please subscribe to continue.',
          );
        default:
          throw new UnauthorizedException('Invalid subscription status');
      }
    } catch (error) {
      this.logger.error(
        `Subscription check failed for user ${user.id}:`,
        error,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.log(error, 'error');

      throw new UnauthorizedException('Error checking subscription status');
    }
  }
}
