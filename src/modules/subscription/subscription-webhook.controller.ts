import {
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Public } from 'src/shared/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { LemonSqueezyRequest } from './dto/lemon-squeezy-request.decorator';
import { PlanId, PRICING_PLANS } from 'src/shared/constants/pricing';
import { PrismaService } from '../prisma/prisma.service';

@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  private readonly logger = new Logger(SubscriptionWebhookController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(@LemonSqueezyRequest() evt: any) {
    try {
      this.logger.log('Webhook endpoint hit');
      this.logger.log(`Event type: ${evt.meta.event_name}`);
      this.logger.debug('Request body:', JSON.stringify(evt, null, 2));

      switch (evt.meta.event_name) {
        case 'order_created':
          await this.handleOrderCreated(evt);
          break;
        case 'subscription_updated':
          await this.handleSubscriptionUpdated(evt);
          break;
        case 'subscription_cancelled':
          await this.handleSubscriptionCancelled(evt);
          break;
        default:
          this.logger.warn(`Unhandled event type: ${evt.meta.event_name}`);
      }

      this.logger.log('Webhook processing completed');
      return { message: 'Webhook received' };
    } catch (err) {
      this.logger.error('Error in handleWebhook:', err);
      throw new HttpException(
        err.message || 'Server error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getPlanFromVariant(variantName: string): PlanId {
    console.log('=== getPlanFromVariant ===');
    console.log('Input variantName:', variantName);

    if (!variantName) {
      console.log('Variant name is empty or undefined');
      throw new Error('Invalid variant name: empty or undefined');
    }

    const lowerVariant = variantName.toLowerCase();
    console.log('Lowercase variant:', lowerVariant);

    // Log all possible matches
    console.log('Checking matches:');
    console.log('- includes "start":', lowerVariant.includes('start'));
    console.log('- includes "starter":', lowerVariant.includes('starter'));
    console.log('- includes "pro":', lowerVariant.includes('pro'));
    console.log('- full variant name:', lowerVariant);

    if (lowerVariant.includes('start')) {
      console.log('Matched: starter plan');
      return 'starter';
    }
    if (lowerVariant.includes('pro')) {
      console.log('Matched: pro plan');
      return 'pro';
    }

    console.log('No match found for variant:', variantName);
    throw new Error(`Invalid plan variant: ${variantName}`);
  }

  private async handleOrderCreated(evt: any) {
    console.log('=== handleOrderCreated ===');
    console.log('Full webhook event:', JSON.stringify(evt, null, 2));

    try {
      console.log('user_id:', evt.meta.custom_data.user_id);
      const customData = evt.meta.custom_data || {};
      console.log('Custom data:', customData);

      const userId = customData.user_id;
      const planId = customData.plan_id as PlanId;
      console.log('Extracted user_id:', userId);
      console.log('Extracted plan_id:', planId);

      if (!userId) {
        throw new Error('No user_id found in custom_data');
      }

      const isSuccessful = evt.data.attributes.status === 'paid';
      const orderCreatedAt = new Date(evt.data.attributes.created_at);
      console.log('Order status:', evt.data.attributes.status);
      console.log('Order created at:', orderCreatedAt);

      console.log('Order attributes:', evt.data.attributes);
      console.log('First order item:', evt.data.attributes.first_order_item);

      const firstOrderItem = evt.data.attributes.first_order_item;
      if (!firstOrderItem) {
        console.log('No first_order_item found in webhook data');
        console.log('Available data:', evt.data.attributes);
        throw new Error('No order items found in webhook data');
      }

      const variantName = firstOrderItem.variant_name;
      console.log('Extracted variant name:', variantName);

      let determinedPlanId: PlanId;
      try {
        determinedPlanId = planId || this.getPlanFromVariant(variantName);
        console.log('Determined plan ID:', determinedPlanId);
      } catch (error) {
        console.log('Error determining plan ID:', error);
        console.log('Variant name that caused error:', variantName);
        throw error;
      }

      let subscriptionLengthInMonths = 1;
      if (
        variantName.toLowerCase().includes('yearly') ||
        variantName.toLowerCase().includes('annual')
      ) {
        subscriptionLengthInMonths = 12;
      }
      console.log('Subscription length:', subscriptionLengthInMonths, 'months');

      const endDate = new Date(orderCreatedAt);
      endDate.setMonth(endDate.getMonth() + subscriptionLengthInMonths);

      const subscriptionData = {
        userId: Number(userId),
        orderId: evt.data.id,
        status: isSuccessful ? 'active' : 'pending',
        planId: determinedPlanId,
        endDate,
        createdAt: orderCreatedAt,
        productName: firstOrderItem.product_name,
        variantName: firstOrderItem.variant_name,
        subscriptionLengthInMonths,
        totalAmount: parseFloat(evt.data.attributes.total),
        currency: evt.data.attributes.currency,
      };

      console.log('Final subscription data:', subscriptionData);
      await this.subscriptionService.createSubscription(subscriptionData);
      console.log('Subscription created successfully');
    } catch (error) {
      console.error('=== Error in handleOrderCreated ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Event data:', evt);
      this.logger.error('Error handling order created:', {
        message: error.message,
        stack: error.stack,
        eventData: evt,
      });
      throw error;
    }
  }

  private async handleSubscriptionUpdated(evt: any) {
    this.logger.log('Processing subscription updated event');
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.user_id;
      const planId = customData.plan_id as PlanId;

      const subscriptionId = evt.data.id;
      const status = evt.data.attributes.status;
      const variantName = evt.data.attributes.variant_name;
      const determinedPlanId = planId || this.getPlanFromVariant(variantName);

      // Update subscription logic here
      // await this.subscriptionService.updateSubscription({
      //   subscriptionId,
      //   status,
      //   planId: determinedPlanId,
      // });
    } catch (error) {
      this.logger.error('Error handling subscription update:', error);
      throw error;
    }
  }

  private async handleSubscriptionCancelled(evt: any) {
    this.logger.log('Processing subscription cancelled event');
    try {
      const customData = evt.meta.custom_data || {};
      const userId = customData.user_id;

      if (!userId) {
        throw new Error('No user_id found in custom_data');
      }

    } catch (error) {
      this.logger.error('Error handling subscription cancellation:', error);
      throw error;
    }
  }
}
