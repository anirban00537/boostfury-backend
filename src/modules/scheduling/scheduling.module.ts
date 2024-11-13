import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentPostingModule } from '../content-posting/content-posting.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ContentPostingModule,
    SubscriptionModule
  ],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {} 