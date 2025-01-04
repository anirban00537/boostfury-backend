import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
import { PaginationOptions } from 'src/shared/utils/pagination.util';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @IsAdmin()
  @Get('dashboard')
  async getDashboardData() {
    return this.adminService.getDashboardData();
  }


  @IsAdmin()
  @Get('get-users')
  async getUsers(@Query() query: PaginationOptions) {
    return this.adminService.getUsers(query);
  }

  @IsAdmin()
  @Get('get-subscriptions')
  async getSubscriptions(@Query() query: PaginationOptions) {
    return this.adminService.getSubscriptions(query);
  }
}
