import { Module, NestModule, RequestMethod } from '@nestjs/common';
import { MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { SubscriptionGuard } from 'src/shared/guards/subscription.guard';
import { MailConfig } from 'src/shared/configs/mail.config';
import { UsersModule } from '../users/users.module';
import { MailModule } from 'src/shared/mail/mail.module';
import { ApiSecretCheckMiddleware } from 'src/shared/middlewares/apisecret.middleware';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { BrandingModule } from '../branding/branding.module';
import { LoggerModule } from '../logger/logger.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AiContentModule } from '../ai-content/ai-content.module';
import { ContentPostingModule } from '../content-posting/content-posting.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [MailConfig],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    MailModule,
    BrandingModule,
    LoggerModule,
    SubscriptionModule,
    AiContentModule,
    ContentPostingModule,
    LinkedInModule,
    SchedulingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiSecretCheckMiddleware)
      .exclude({
        path: `/${coreConstant.FILE_DESTINATION}/*`,
        method: RequestMethod.ALL,
      })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
