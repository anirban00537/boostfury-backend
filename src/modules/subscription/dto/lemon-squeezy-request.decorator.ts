import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  createParamDecorator,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { webhookHasData, webhookHasMeta } from '../subscription-webhook.utils';

export const LemonSqueezyRequest = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SIGNATURE;

    if (!secret) {
      throw new Error(
        'LEMONSQUEEZY_WEBHOOK_SIGNATURE is not set in the environment',
      );
    }

    const signature = request.headers['x-signature'] as string;
    const rawBody = request.rawBody;

    if (!rawBody) {
      throw new HttpException('No raw body found', HttpStatus.BAD_REQUEST);
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

    const evt = JSON.parse(rawBody.toString('utf8'));

    if (!webhookHasMeta(evt)) {
      throw new HttpException('Missing Event Meta', HttpStatus.BAD_REQUEST);
    }

    if (!webhookHasData(evt)) {
      throw new HttpException('Missing Event Data', HttpStatus.BAD_REQUEST);
    }

    return evt;
  },
);
