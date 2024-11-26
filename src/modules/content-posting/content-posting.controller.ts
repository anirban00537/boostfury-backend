import {
  Controller,
  Post,
  Body,
  Request,
  Get,
  Query,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ContentPostingService } from './content-posting.service';
import { CreateOrUpdateDraftPostDto } from './dto/create-draft-post.dto';
import { GetPostsQueryDto } from './dto/get-posts.query.dto';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerUploadConfig } from 'src/shared/configs/multer-upload.config';
import { UpdateTimeSlotsDto } from './dto/time-slot.dto';

@Controller('content-posting')
export class ContentPostingController {
  constructor(private readonly contentPostingService: ContentPostingService) {}

  @Post('create-or-update-post')
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

  @Get('get-draft-scheduled-post-details/:id')
  @IsSubscribed()
  async getDraftPost(@UserInfo() userInfo: User, @Param('id') id: string) {
    return this.contentPostingService.getDraftScheduledPost(userInfo.id, id);
  }

  @Post('post-now/:id')
  @IsSubscribed()
  async postNow(@UserInfo() userInfo: User, @Param('id') postId: string) {
    return this.contentPostingService.postNow(userInfo.id, postId);
  }

  @Post('schedule/:id')
  @IsSubscribed()
  async schedulePost(
    @UserInfo() userInfo: User,
    @Param('id') postId: string,
    @Body() scheduleDto: { scheduledTime: string; timeZone: string },
  ) {
    return this.contentPostingService.schedulePost(
      userInfo.id,
      postId,
      scheduleDto.scheduledTime,
      scheduleDto.timeZone,
    );
  }

  @Delete('delete-post/:id')
  @IsSubscribed()
  async deleteDraftPost(@UserInfo() userInfo: User, @Param('id') id: string) {
    return this.contentPostingService.deletePost(userInfo.id, id);
  }

  @Post(':postId/upload-image')
  @IsSubscribed()
  @UseInterceptors(FileInterceptor('file', multerUploadConfig))
  async uploadImage(
    @UserInfo() userInfo: User,
    @Param('postId') postId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.contentPostingService.uploadImage(userInfo.id, postId, file);
  }

  @Delete(':postId/images/:imageId')
  @IsSubscribed()
  async deleteImage(
    @UserInfo() userInfo: User,
    @Param('postId') postId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.contentPostingService.deleteImage(userInfo.id, postId, imageId);
  }

  @Post(':postId/reorder-images')
  @IsSubscribed()
  async reorderImages(
    @UserInfo() userInfo: User,
    @Param('postId') postId: string,
    @Body('imageIds') imageIds: string[],
  ) {
    return this.contentPostingService.reorderImages(
      userInfo.id,
      postId,
      imageIds,
    );
  }

  @Get('scheduled-queue')
  @IsSubscribed()
  async getScheduledQueue(
    @UserInfo() userInfo: User,
    @Query() query: GetPostsQueryDto,
  ) {
    return this.contentPostingService.getScheduledQueue(userInfo.id, {
      page: query.page,
      pageSize: query.pageSize,
      workspace_id: query.workspace_id,
    });
  }

  @Get('workspaces/:workspaceId/time-slots')
  @IsSubscribed()
  async getTimeSlots(
    @UserInfo() userInfo: User,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.contentPostingService.getTimeSlots(userInfo.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/time-slots')
  @IsSubscribed()
  async createAndUpdateTimeSlots(
    @UserInfo() userInfo: User,
    @Param('workspaceId') workspaceId: string,
    @Body() updateTimeSlotsDto: UpdateTimeSlotsDto,
  ) {
    return this.contentPostingService.createAndUpdateTimeSlots(
      userInfo.id,
      workspaceId,
      updateTimeSlotsDto.timeSlots,
    );
  }

  @Post('add-to-queue/:id')
  @IsSubscribed()
  async addToQueue(
    @UserInfo() userInfo: User,
    @Param('id') postId: string,
    @Body('timeZone') timeZone: string,
  ) {
    return this.contentPostingService.addToQueue(userInfo.id, postId);
  }

  @Post('shuffle-queue')
  @IsSubscribed()
  async shuffleQueue(
    @UserInfo() userInfo: User,
    @Body('workspaceId') workspaceId: string,
  ) {
    return this.contentPostingService.shuffleQueue(userInfo.id, workspaceId);
  }
}
