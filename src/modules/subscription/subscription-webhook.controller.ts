import {
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Public } from 'src/shared/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';
import { LemonSqueezyRequest } from './dto/lemon-squeezy-request.decorator';

@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  private readonly logger = new Logger(SubscriptionWebhookController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(@LemonSqueezyRequest() evt: any) {
    try {
      console.log('Webhook endpoint hit');
      console.log(`Event type: ${evt.meta.event_name}`);
      console.debug('Request body:', JSON.stringify(evt, null, 2));

      switch (evt.meta.event_name) {
        case 'order_created':
          await this.subscriptionService.handleOrderCreated(evt);
          break;
        case 'subscription_updated':
          await this.subscriptionService.handleSubscriptionUpdated(evt);
          break;
        case 'subscription_cancelled':
          await this.subscriptionService.handleSubscriptionCancelled(evt);
          break;
        default:
          console.warn(`Unhandled event type: ${evt.meta.event_name}`);
      }

      console.log('Webhook processing completed');
      return { message: 'Webhook received' };
    } catch (err) {
      console.error('Error in handleWebhook:', err);
      throw new HttpException(
        err.message || 'Server error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
