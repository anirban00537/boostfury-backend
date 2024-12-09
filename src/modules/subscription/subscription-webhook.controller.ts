import { Controller, Post, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from 'src/shared/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';
import { LemonSqueezyRequest } from './dto/lemon-squeezy-request.decorator';

@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Post()
  async handleWebhook(@LemonSqueezyRequest() evt: any) {
    try {
      console.log('=== Webhook Processing Started ===');
      console.log(`Event type:`, evt.meta.event_name);
      console.log('Full webhook payload:', JSON.stringify(evt, null, 2));
      console.log('Custom data:', evt.meta.custom_data);

      switch (evt.meta.event_name) {
        case 'subscription_created':
          console.log('Processing subscription_created event');
          await this.subscriptionService.handleSubscriptionCreated(evt);
          break;
        case 'subscription_updated':
          console.log('Processing subscription_updated event');
          await this.subscriptionService.handleSubscriptionUpdated(evt);
          break;
        case 'subscription_cancelled':
          console.log('Processing subscription_cancelled event');
          await this.subscriptionService.handleSubscriptionCancelled(evt);
          break;
        case 'subscription_expired':
          console.log('Processing subscription_expired event');
          await this.subscriptionService.handleSubscriptionExpired(evt);
          break;
        default:
          console.warn(`⚠️ Unhandled event type: ${evt.meta.event_name}`);
      }

      console.log('=== Webhook Processing Completed ===');
      return { message: 'Webhook processed successfully' };
    } catch (err) {
      console.error('=== Webhook Processing Error ===');
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        eventType: evt?.meta?.event_name,
        customData: evt?.meta?.custom_data,
      });
      throw new HttpException(
        err.message || 'Server error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
