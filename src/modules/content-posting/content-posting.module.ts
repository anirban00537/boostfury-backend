import { Module } from '@nestjs/common';
import { ContentPostingController } from './content-posting.controller';
import { ContentPostingService } from './content-posting.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { AiContentModule } from '../ai-content/ai-content.module';

@Module({
  imports: [PrismaModule, LinkedInModule, AiContentModule],
  controllers: [ContentPostingController],
  providers: [ContentPostingService],
  exports: [ContentPostingService],
})
export class ContentPostingModule {}
