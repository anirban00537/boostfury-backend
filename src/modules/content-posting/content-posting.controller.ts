import {
  Controller,
  Post,
  Body,
  Request,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ContentPostingService } from './content-posting.service';
import { CreateOrUpdateDraftPostDto } from './dto/create-draft-post.dto';
import { GetPostsQueryDto } from './dto/get-posts.query.dto';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';

@Controller('content-posting')
export class ContentPostingController {
  constructor(private readonly contentPostingService: ContentPostingService) {}

  @Post('create-or-update-draft')
  @IsSubscribed()
  async createOrUpdateDraftPost(
    @UserInfo() userInfo: User,
    @Body() createOrUpdateDraftPostDto: CreateOrUpdateDraftPostDto,
  ) {
    return this.contentPostingService.createOrUpdateDraftPost(
      userInfo.id,
      createOrUpdateDraftPostDto,
    );
  }

  @Get('get-posts')
  @IsSubscribed()
  async getPosts(@UserInfo() userInfo: User, @Query() query: GetPostsQueryDto) {
    return this.contentPostingService.getPosts(userInfo, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      workspace_id: query.workspace_id,
    });
  }

  @Get('get-draft-post-details/:id')
  @IsSubscribed()
  async getDraftPost(@UserInfo() userInfo: User, @Param('id') id: number) {
    return this.contentPostingService.getDraftPost(userInfo.id, id);
  }

  @Post('post-now/:id')
  @IsSubscribed()
  async postNow(@UserInfo() userInfo: User, @Param('id') postId: number) {
    return this.contentPostingService.postNow(userInfo.id, postId);
  }

  @Post('schedule/:id')
  @IsSubscribed()
  async schedulePost(
    @UserInfo() userInfo: User,
    @Param('id') postId: number,
    @Body() scheduleDto: { scheduledTime: string; timeZone: string },
  ) {
    return this.contentPostingService.schedulePost(
      userInfo.id,
      postId,
      scheduleDto.scheduledTime,
      scheduleDto.timeZone,
    );
  }
}
