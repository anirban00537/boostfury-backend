import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Param,
  Req,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { BrandingService } from './branding.service';
import { CreateUpdateBrandingDto } from './dto/create-update-branding.dto';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { User } from '../users/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerUploadConfig } from 'src/shared/configs/multer-upload.config';
import { Request } from 'express';
import { userInfo } from 'os';
import { IsSubscribed } from 'src/shared/decorators/is-subscribed.decorator';

@Controller('branding')
@UseInterceptors(ClassSerializerInterceptor)
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Post('create-update-branding')
  @UseInterceptors(FileInterceptor('headshot', multerUploadConfig))
  async createUpdateBranding(
    @Body() createUpdateBrandingDto: CreateUpdateBrandingDto,
    @UploadedFile() headshot: Express.Multer.File,
    @Req() request: Request,
    @UserInfo() user: User,
  ) {
    console.log('Received file:', headshot);
    if (headshot) {
      console.log('File buffer exists:', !!headshot.buffer);
      console.log('File path:', headshot.path);
    }

    return this.brandingService.createUpdateBranding(
      user.id,
      createUpdateBrandingDto,
      headshot,
    );
  }

  @Get('get-branding')
  @IsSubscribed()
  getBranding(@UserInfo() user: User) {
    return this.brandingService.getBranding(user.id);
  }
}
