import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
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

  @Post('give-subscription')
  @IsAdmin()
  async giveSubscription(
    @Body() body: { email: string; durationInMonths: number },
  ) {
    return this.subscriptionService.giveSubscription(
      body.email,
      body.durationInMonths,
    );
  }
  @Get('get-all-subscriptions')
  @IsAdmin()
  async getAllSubscriptions() {
    return this.subscriptionService.getAllSubscriptions();
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
