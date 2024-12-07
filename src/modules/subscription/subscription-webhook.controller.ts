import { Controller, Post, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { Public } from 'src/shared/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';
import { Request } from 'express';
import { EventName, Paddle, Environment } from '@paddle/paddle-node-sdk';
import { ConfigService } from '@nestjs/config';

@Controller('subscription/webhook')
export class SubscriptionWebhookController {
  private readonly paddle: Paddle;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get('PADDLE_API_KEY');
    const environment = this.configService.get('NODE_ENV') === 'production' 
      ? Environment.production 
      : Environment.sandbox;
    
    this.paddle = new Paddle(apiKey, { environment });
  }

  @Public()
  @Post()
  async handleWebhook(
    @Headers('paddle-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      const webhookSecret = this.configService.get('PADDLE_WEBHOOK_SECRET');
      const rawBody = req.rawBody?.toString() || '';
      
      const event = await this.paddle.webhooks.unmarshal(
        rawBody,
        webhookSecret,
        signature
      );

      switch (event.eventType) {
        case EventName.SubscriptionCreated:
          await this.subscriptionService.handleSubscriptionCreated(event);
          break;
        case EventName.SubscriptionUpdated:
          await this.subscriptionService.handleSubscriptionUpdated(event);
          break;
        case EventName.SubscriptionCanceled:
          await this.subscriptionService.handleSubscriptionCancelled(event);
          break;
        case EventName.CustomerCreated:
        case EventName.CustomerUpdated:
          await this.subscriptionService.handleCustomerUpdate(event);
          break;
        default:
          console.warn(`⚠️ Unhandled event type: ${event.eventType}`);
      }

      return { status: 200, eventName: event.eventType };
    } catch (error) {
      console.error('Webhook Processing Error:', error);
      throw error;
    }
  }
}
