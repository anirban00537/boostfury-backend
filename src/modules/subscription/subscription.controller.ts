import { Controller, Get, Post, Body } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { Public } from 'src/shared/decorators/public.decorator';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('check-subscription')
  async checkSubscription(@UserInfo() user: User) {
    return this.subscriptionService.checkSubscriptionResponse(user);
  }

  @Post('create-checkout')
  async createCheckout(
    @UserInfo() user: User,
    @Body() body: { variantId: string; redirectUrl: string },
  ) {
    const checkoutUrl = await this.subscriptionService.createCheckout(
      user,
      body.variantId,
      body.redirectUrl,
    );
    return { checkoutUrl };
  }

  @Get('get-packages')
  @Public()
  async getPricing() {
    return this.subscriptionService.getPricing();
  }

  @Post('cancel-subscription')
  async cancelSubscription(@UserInfo() user: User) {
    return this.subscriptionService.cancelSubscription(user.id);
  }
}
