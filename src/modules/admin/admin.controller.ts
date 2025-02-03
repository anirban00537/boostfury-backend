import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
import { AdminService } from './admin.service';
import { CreatePackageDto } from '../subscription/dto/create-package.dto';
import { UpdatePackageDto } from '../subscription/dto/update-package.dto';
import { ResponseModel } from 'src/shared/models/response.model';

@Controller('admin')
@IsAdmin() // Apply IsAdmin guard to all routes in this controller
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // User Management
  @Get('users')
  async getAllUsers(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
    @Query('search') search?: string,
  ): Promise<ResponseModel> {
    const options = {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      orderBy: orderBy
        ? { [orderBy]: orderDirection || ('desc' as const) }
        : { createdAt: 'desc' as const },
      search: search?.trim(),
    };

    return this.adminService.getAllUsers(options);
  }

  // Package Management
  @Post('packages')
  async createPackage(@Body() createPackageDto: CreatePackageDto) {
    return this.adminService.createPackage(createPackageDto);
  }

  @Put('packages/:id')
  async updatePackage(
    @Param('id') id: string,
    @Body() updatePackageDto: UpdatePackageDto,
  ) {
    return this.adminService.updatePackage(id, updatePackageDto);
  }

  @Delete('packages/:id')
  async deletePackage(@Param('id') id: string) {
    return this.adminService.deletePackage(id);
  }

  @Get('packages/:id')
  async getPackage(@Param('id') id: string) {
    return this.adminService.getPackageById(id);
  }

  @Get('packages')
  async getAllPackages() {
    return this.adminService.getAllPackages();
  }

  // Subscription Management
  @Post('give-subscription')
  async giveSubscription(
    @Body() body: { email: string; durationInMonths: number },
  ) {
    return this.adminService.giveSubscription(
      body.email,
      body.durationInMonths,
    );
  }

  @Get('subscriptions')
  async getAllSubscriptions() {
    return this.adminService.getAllSubscriptions();
  }

  // Dashboard Data
  @Get('dashboard')
  async getDashboardData() {
    return this.adminService.getDashboardData();
  }
}
