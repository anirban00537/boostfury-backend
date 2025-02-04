import { Module } from '@nestjs/common';
import { AiContentService } from './ai-content.service';
import { AiContentController } from './ai-content.controller';
import { OpenAIService } from './openai.service';
import { WebsiteScreenshotService } from './website-screenshot.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiContentController],
  providers: [
    AiContentService,
    OpenAIService,
    WebsiteScreenshotService,
  ],
  exports: [
    AiContentService,
    OpenAIService,
    WebsiteScreenshotService,
  ],
})
export class AiContentModule {}
