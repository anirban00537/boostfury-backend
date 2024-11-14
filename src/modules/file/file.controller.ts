import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { multerUploadConfig } from '../../shared/configs/multer-upload.config';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '@prisma/client';
import { ResponseModel } from 'src/shared/models/response.model';
import { memoryStorage } from 'multer';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';

@Controller('files')
@UseInterceptors(ClassSerializerInterceptor)
export class FileController {
  constructor(private readonly fileService: FileService) {}
  @Post('upload')
  @IsSubscribed()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      ...multerUploadConfig,
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @UserInfo() user: User,
  ): Promise<ResponseModel> {
    return this.fileService.uploadImage(file, user);
  }
  @Get('files')
  async getFiles(
    @UserInfo() user: User,
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
  ): Promise<ResponseModel> {
    return this.fileService.getFiles(user, { page, pageSize });
  }

  @Get('usages')
  async getImageUsage(@UserInfo() user: User): Promise<ResponseModel> {
    return this.fileService.getImageUsage(user.id);
  }

  @Get('file/:id')
  @IsSubscribed()
  async getFile(@Param('id') id: string): Promise<ResponseModel> {
    return this.fileService.getFile(id);
  }

  @Delete(':id')
  @IsSubscribed()
  async deleteFile(
    @Param('id') id: string,
    @UserInfo() user: User,
  ): Promise<ResponseModel> {
    return this.fileService.deleteFile(id, user);
  }
}
