import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { IS_SUBSCRIBED_KEY } from '../decorators/is-subscribed.decorator';
import { SubscriptionService } from '../../modules/subscription/subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSubscribed = this.reflector.getAllAndOverride<boolean>(IS_SUBSCRIBED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isSubscribed) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      const [isTrialActive, subscription] = await Promise.all([
        this.subscriptionService.isTrialActive(user.id),
        this.prisma.subscription.findUnique({
          where: { userId: user.id },
        }),
      ]);

      if (isTrialActive) {
        return true;
      }

      const isSubscriptionActive = subscription?.endDate > new Date();

      if (!isSubscriptionActive) {
        throw new UnauthorizedException(
          'Trial period has ended. Please subscribe to continue.'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Error checking subscription status');
    }
  }
} 