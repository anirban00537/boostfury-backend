import { Module } from '@nestjs/common';
import { ContentPostingController } from './content-posting.controller';
import { ContentPostingService } from './content-posting.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LinkedInModule } from '../linkedin/linkedin.module';

@Module({
  imports: [PrismaModule, LinkedInModule],
  controllers: [ContentPostingController],
  providers: [ContentPostingService],
  exports: [ContentPostingService],
})
export class ContentPostingModule {}
