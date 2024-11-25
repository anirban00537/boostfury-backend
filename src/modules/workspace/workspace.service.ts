import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { ResponseModel } from 'src/shared/models/response.model';
import {
  errorResponse,
  processException,
  successResponse,
} from 'src/shared/helpers/functions';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateWorkspacePersonalAiVoiceDto } from './dto/update-workspace-personal-ai-voice.dto';
@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async getMyWorkspaces(user: User): Promise<ResponseModel> {
    try {
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          userId: user.id,
        },
      });
      if (!workspaces) {
        return errorResponse('No workspaces found', null);
      }
      return successResponse('Workspaces fetched successfully', workspaces);
    } catch (error) {}
  }

  async createWorkspace(
    createWorkspaceDto: CreateWorkspaceDto,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const workspace = await this.prisma.workspace.create({
        data: {
          userId: user.id,
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
        },
      });
      if (!workspace) {
        return errorResponse('Failed to create workspace', null);
      }
      return successResponse('Workspace created successfully', workspace);
    } catch (error) {
      processException(error);
    }
  }
  async updateWorkspacePersonalAiVoice(
    updateWorkspacePersonalAiVoiceDto: UpdateWorkspacePersonalAiVoiceDto,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const workspace = await this.prisma.workspace.update({
        where: { id: updateWorkspacePersonalAiVoiceDto.id, userId: user.id },
        data: {
          personalAiVoice: updateWorkspacePersonalAiVoiceDto.personalAiVoice,
        },
      });
      if (!workspace) {
        return errorResponse(
          'Failed to update workspace personal ai voice',
          null,
        );
      }
      return successResponse(
        'Workspace personal ai voice updated successfully',
        workspace,
      );
    } catch (error) {
      processException(error);
    }
  }

  async updateWorkspace(
    updateWorkspaceDto: UpdateWorkspaceDto,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const workspace = await this.prisma.workspace.update({
        where: { id: updateWorkspaceDto.id, userId: user.id },
        data: {
          name: updateWorkspaceDto.name,
          description: updateWorkspaceDto.description,
        },
      });
      if (!workspace) {
        return errorResponse("You don't have any workspace with this id", null);
      }
      return successResponse('Workspace updated successfully', workspace);
    } catch (error) {
      processException(error);
    }
  }

  async deleteWorkspace(id: string, user: User): Promise<ResponseModel> {
    try {
      const workspace = await this.prisma.workspace.delete({
        where: { id, userId: user.id },
      });
      if (!workspace) {
        return errorResponse("You don't have any workspace with this id", null);
      }
      return successResponse('Workspace deleted successfully', workspace);
    } catch (error) {
      processException(error);
    }
  }

  async getMyWorkspaceById(
    workspaceId: string,
    user: User,
  ): Promise<ResponseModel> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId, userId: user.id },
      });
      if (!workspace) {
        return errorResponse("You don't have any workspace with this id", null);
      }
      return successResponse('Workspace fetched successfully', workspace);
    } catch (error) {
      processException(error);
    }
  }
}
