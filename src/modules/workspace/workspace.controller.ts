import { Controller, Delete, Get, Param, Post, Body } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('get-my-workspaces')
  getMyWorkspaces(@UserInfo() user: User) {
    return this.workspaceService.getMyWorkspaces(user);
  }

  @Post('create-workspace')
  @IsSubscribed()
  createWorkspace(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @UserInfo() user: User,
  ) {
    return this.workspaceService.createWorkspace(createWorkspaceDto, user);
  }

  @Post('update-workspace')
  @IsSubscribed()
  updateWorkspace(
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @UserInfo() user: User,
  ) {
    return this.workspaceService.updateWorkspace(updateWorkspaceDto, user);
  }

  @Delete('delete-workspace/:id')
  @IsSubscribed()
  deleteWorkspace(@Param('id') id: string, @UserInfo() user: User) {
    return this.workspaceService.deleteWorkspace(id, user);
  }
  @Get('get-my-workspace-by-id/:workspaceId')
  getMyWorkspaceById(
    @Param('workspaceId') workspaceId: string,
    @UserInfo() user: User,
  ) {
    return this.workspaceService.getMyWorkspaceById(workspaceId, user);
  }
}
