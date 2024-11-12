import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { IS_SUBSCRIBED_KEY } from '../decorators/is-subscribed.decorator';

@Injectable()
export class IsSubscribedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
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

    const subscriptionStatus = await this.subscriptionService.checkSubscription(user);
    return subscriptionStatus.isSubscribed;
  }
} 