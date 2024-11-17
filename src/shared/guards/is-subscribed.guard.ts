import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { IS_SUBSCRIBED_KEY } from '../decorators/is-subscribed.decorator';
import { coreConstant } from '../helpers/coreConstant';

@Injectable()
export class IsSubscribedGuard implements CanActivate {
  private readonly logger = new Logger(IsSubscribedGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const checkSubscription = this.reflector.get<boolean>(
      IS_SUBSCRIBED_KEY,
      context.getHandler(),
    );

    if (!checkSubscription) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId: user.id },
        include: { package: true },
      });

      if (!subscription) {
        this.logger.debug(`No subscription found for user ${user.id}`);
        return false;
      }

      const now = new Date();
      const isValid =
        // Check if subscription is active or trial
        subscription.status === coreConstant.SUBSCRIPTION_STATUS.ACTIVE &&
        // Check if subscription hasn't expired
        subscription.endDate > now;

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error checking subscription for user ${user.id}:`,
        error,
      );
      return false;
    }
  }
}
