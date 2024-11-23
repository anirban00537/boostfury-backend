import { Module } from '@nestjs/common';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { ContentPostingModule } from '../content-posting/content-posting.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ContentPostingModule,
    PrismaModule,
  ],
  controllers: [CarouselController],
  providers: [CarouselService],
  exports: [CarouselService],
})
export class CarouselModule {}
