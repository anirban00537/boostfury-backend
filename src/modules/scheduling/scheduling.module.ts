import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentPostingModule } from '../content-posting/content-posting.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SchedulingService } from './scheduling.service';
import { SubscriptionCronService } from './subscription-cron.service';
import { MailModule } from 'src/shared/mail/mail.module';
import { DatabaseBackupCronService } from './database-backup-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ContentPostingModule,
    SubscriptionModule,
    MailModule,
  ],
  providers: [
    SchedulingService,
    SubscriptionCronService,
    DatabaseBackupCronService,
  ],
  exports: [
    SchedulingService,
    SubscriptionCronService,
    DatabaseBackupCronService,
  ],
})
export class SchedulingModule {}