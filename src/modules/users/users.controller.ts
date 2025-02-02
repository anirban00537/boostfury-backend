import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponse } from './dto/user-response';
import { UsersService } from './users.service';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
import { errorResponse, successResponse } from 'src/shared/helpers/functions';
import { User } from '@prisma/client';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { ResponseModel } from 'src/shared/models/response.model';
import { UserInfo } from 'src/shared/decorators/user.decorators';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UsersService) {}
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    let user = req.user;
    delete user.password;
    delete user.linkedin_access_token;
    if (!user) {
      return errorResponse('Please login inorder to get profile data');
    }
    if (user.role === coreConstant.USER_ROLE_ADMIN) {
      const admin = {
        ...user,
        is_admin: true,
      };
      return successResponse('Admin Response successfully', admin);
    }
    return successResponse('Response successfully', user);
  }

  @IsAdmin()
  @Get('admin/dashboard')
  getAdminDashboardData(): Promise<ResponseModel> {
    return this.userService.getAdminDashboardData();
  }

  /** Creates a new user */
  @IsAdmin()
  @Post('create-user')
  create(@Body() payload: CreateUserDto): Promise<UserResponse> {
    return this.userService.create(payload);
  }

  // get all user list
  @IsAdmin()
  @Get('user-list')
  list(@Query() payload: any): Promise<ResponseModel> {
    return this.userService.userList(payload);
  }

  @Post('update-profile')
  updateProfile(
    @UserInfo() user: User,
    @Body() payload: UpdateUserDto,
  ): Promise<ResponseModel> {
    return this.userService.updateProfile(user, payload);
  }

  @Post('check-user-name')
  checkUserNameIsUnique(
    @UserInfo() user: User,
    @Body()
    payload: {
      user_name: string;
    },
  ): Promise<ResponseModel> {
    return this.userService.checkUserNameIsUnique(user, payload);
  }

  @IsAdmin()
  @Post('change-status')
  changeStatus(@Body() payload: { user_id: string }): Promise<ResponseModel> {
    return this.userService.changeStatus(payload);
  }

  @Get('user-list-by-country')
  userListByCountryWise(): Promise<ResponseModel> {
    return this.userService.userListByCountryWise();
  }

  @IsAdmin()
  @Get('user-profile-details')
  userProfileDetails(
    @Query() payload: { user_id: string },
  ): Promise<ResponseModel> {
    return this.userService.userProfileDetails(payload);
  }

  @IsAdmin()
  @Post('update-email')
  updateEmail(
    @UserInfo() user: User,
    @Body()
    payload: {
      email: string;
    },
  ): Promise<ResponseModel> {
    return this.userService.updateEmail(user, payload);
  }
}
