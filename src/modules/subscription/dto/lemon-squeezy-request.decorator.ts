import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

export const LemonSqueezyRequest = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const rawBody = request.rawBody;
    const signature = request.headers['x-signature'];
    
    if (!request.body || !request.body.meta) {
      throw new BadRequestException('Missing Event Meta');
    }

    // Verify webhook signature if provided
    if (signature) {
      const configService = new ConfigService();
      const webhookSecret = configService.get('LEMONSQUEEZY_WEBHOOK_SECRET');
      
      if (webhookSecret) {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const digest = hmac.update(rawBody).digest('hex');
        
        if (signature !== digest) {
          throw new BadRequestException('Invalid webhook signature');
        }
      }
    }

    return request.body;
  },
);
