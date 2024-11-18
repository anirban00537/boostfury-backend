import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiContentService } from './ai-content.service';
import { ResponseModel } from 'src/shared/models/response.model';
import { GenerateCarouselContentDto } from './dto/generate-caorusel-content.dto';
import { GenerateLinkedInPostsDto } from './dto/generate-linkedin-posts.dto';
import { User } from '../users/entities/user.entity';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';
import { GenerateContentIdeasForWorkspaceDto } from './dto/generate-content-ideas.dto';

@Controller('ai-content')
export class AiContentController {
  constructor(private readonly aiContentService: AiContentService) {}

  @Post('generate-carousel-content')
  generateCarouselContent(
    @UserInfo() user: User,
    @Body() dto: GenerateCarouselContentDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.generateCarouselContent(user.id, dto);
  }

  @Post('generate-linkedin-post-content-for-carousel')
  @IsSubscribed()
  generateLinkedInPostContentForCarousel(
    @UserInfo() user: User,
    @Body() { topic }: { topic: string },
  ): Promise<ResponseModel> {
    return this.aiContentService.generateLinkedInPostContentForCarousel(
      user.id,
      topic,
    );
  }

  @Post('generate-linkedin-posts')
  @IsSubscribed()
  generateLinkedInPosts(
    @UserInfo() user: User,
    @Body() dto: GenerateLinkedInPostsDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.generateLinkedInPosts(user.id.toString(), dto);
  }

  @Post('generate-content-ideas-for-workspace')
  generateContentIdeasForWorkspace(
    @UserInfo() user: User,
    @Body() dto: GenerateContentIdeasForWorkspaceDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.generateContentIdeasForWorkspace(user.id, dto);
  }
}
