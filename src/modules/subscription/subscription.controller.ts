import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
import { User } from '@prisma/client';
import { Public } from 'src/shared/decorators/public.decorator';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Subscriptions')
@Controller('subscription')
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Check current user's subscription status
   * GET /api/subscription/check
   * Returns active subscription details and status
   */
  @Get('check')
  @ApiOperation({ summary: 'Check current user subscription status' })
  async checkSubscription(@UserInfo() user: User) {
    return this.subscriptionService.checkSubscriptionResponse(user);
  }

  /**
   * Create a new checkout session for subscription purchase
   * POST /api/subscription/create-checkout
   * @body priceId - Paddle price ID for the package
   * @body redirectUrl - URL to redirect after successful checkout
   * Returns checkout URL for redirect
   */
  @Post('create-checkout')
  @ApiOperation({ summary: 'Create a checkout session' })
  async createCheckout(
    @UserInfo() user: User,
    @Body() body: { priceId: string; redirectUrl: string },
  ) {
    const checkoutUrl = await this.subscriptionService.createCheckout(
      user,
      body.priceId,
      body.redirectUrl,
    );
    return { checkoutUrl };
  }

  /**
   * Cancel an active subscription
   * POST /api/subscription/cancel/:subscriptionId
   * Cancels at the end of current billing period
   * Requires active subscription
   */
  @Post('cancel/:subscriptionId')
  @IsSubscribed()
  @ApiOperation({ summary: 'Cancel a subscription' })
  async cancelSubscription(
    @UserInfo() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptionService.cancelSubscription(subscriptionId);
  }

  /**
   * Admin endpoint to give free subscription to user
   * POST /api/subscription/give-subscription
   * @body email - User's email
   * @body durationInMonths - Subscription duration
   * Admin only access
   */
  @Post('give-subscription')
  @IsAdmin()
  @ApiOperation({ summary: 'Give subscription to user (Admin only)' })
  async giveSubscription(
    @Body() body: { email: string; durationInMonths: number },
  ) {
    return this.subscriptionService.giveSubscription(
      body.email,
      body.durationInMonths,
    );
  }

  /**
   * Admin endpoint to view all subscriptions
   * GET /api/subscription/admin/subscriptions
   * Optional pagination with page and limit query params
   * Admin only access
   */
  @Get('admin/subscriptions')
  @IsAdmin()
  @ApiOperation({ summary: 'Get all subscriptions (Admin only)' })
  async getAllSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.subscriptionService.getAllSubscriptions();
  }

  /**
   * Get available subscription packages/pricing
   * GET /api/subscription/packages
   * Public endpoint - no auth required
   * Returns all active subscription packages
   */
  @Get('packages')
  @Public()
  @ApiOperation({ summary: 'Get available subscription packages' })
  async getPackages() {
    return this.subscriptionService.getPricing();
  }

  /**
   * Start a trial subscription for new user
   * POST /api/subscription/trial
   * Creates a time-limited trial subscription
   */
  @Post('trial')
  @ApiOperation({ summary: 'Start trial subscription' })
  async startTrial(@UserInfo() user: User) {
    return this.subscriptionService.createTrialSubscription(user.id);
  }

  /**
   * Get current subscription usage details
   * GET /api/subscription/usage
   * Returns word and post usage limits/counts
   * Requires active subscription
   */
  @Get('usage')
  @IsSubscribed()
  @ApiOperation({ summary: 'Get subscription usage details' })
  async getUsage(@UserInfo() user: User) {
    return this.subscriptionService.getSubscriptionUsage(user.id);
  }

  /**
   * Get detailed information about specific subscription
   * GET /api/subscription/:subscriptionId
   * Returns subscription details from both DB and Paddle
   * Requires active subscription
   */
  @Get(':subscriptionId')
  @IsSubscribed()
  @ApiOperation({ summary: 'Get subscription details' })
  async getSubscription(
    @UserInfo() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptionService.getSubscriptionDetails(user.id, subscriptionId);
  }
}
