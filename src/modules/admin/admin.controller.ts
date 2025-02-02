import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import { IsAdmin } from 'src/shared/decorators/is-admin.decorator';
import { AdminService } from './admin.service';
import { CreatePackageDto } from '../subscription/dto/create-package.dto';
import { UpdatePackageDto } from '../subscription/dto/update-package.dto';

@Controller('admin')
@IsAdmin() // Apply IsAdmin guard to all routes in this controller
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
