import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionWebhookController } from './subscription-webhook.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleUtil } from 'src/shared/utils';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SubscriptionController, SubscriptionWebhookController],
  providers: [SubscriptionService, PrismaService, PaddleUtil],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
