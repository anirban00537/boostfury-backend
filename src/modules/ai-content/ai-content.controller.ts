import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { AiContentService } from './ai-content.service';
import { ResponseModel } from 'src/shared/models/response.model';
import { GenerateLinkedInPostsDto } from './dto/generate-linkedin-posts.dto';
import { User } from '../users/entities/user.entity';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';
import { RewriteContentDto } from './dto/rewrite-content.dto';
import { UpdateAiStyleDto } from './dto/update-ai-style.dto';
import { GeneratePersonalizedPostDto } from './dto/generate-personalized-post.dto';

@Controller('ai-content')
export class AiContentController {
  constructor(private readonly aiContentService: AiContentService) {}



  @Post('generate-linkedin-posts')
  @IsSubscribed()
  generateLinkedInPosts(
    @UserInfo() user: User,
    @Body() dto: GenerateLinkedInPostsDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.generateLinkedInPosts(user.id.toString(), dto);
  }

  @Post('rewrite-content')
  @IsSubscribed()
  rewriteContent(
    @UserInfo() user: User,
    @Body() dto: RewriteContentDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.rewriteContent(user.id, dto);
  }

  @Post('linkedin-profiles/ai-style/:linkedInProfileId')
  @IsSubscribed()
  async updateAiStyle(
    @UserInfo() user: User,
    @Param('linkedInProfileId') linkedInProfileId: string,
    @Body() updateAiStyleDto: UpdateAiStyleDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.updateAiStyle(
      user.id,
      linkedInProfileId,
      updateAiStyleDto,
    );
  }

  @Get('linkedin-profiles/ai-style/:linkedInProfileId')
  @IsSubscribed()
  async getAiStyle(
    @UserInfo() user: User,
    @Param('linkedInProfileId') linkedInProfileId: string,
  ): Promise<ResponseModel> {
    return this.aiContentService.getAiStyle(user.id, linkedInProfileId);
  }

  @Post('generate-personalized-post')
  @IsSubscribed()
  async generatePersonalizedPost(
    @UserInfo() user: User,
    @Body() dto: GeneratePersonalizedPostDto,
  ): Promise<ResponseModel> {
    return this.aiContentService.generatePersonalizedPost(user.id, dto);
  }
}
