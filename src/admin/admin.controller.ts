import { Body, Controller, Get, Param, Post, Patch, Delete, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOperationsOverview() {
    return this.adminService.getOperationsOverview();
  }

  @Get('disputes/open')
  listOpenDisputes() {
    return this.adminService.listOpenDisputes();
  }

  @Post('disputes/:id/resolve')
  resolveDispute(
    @Param('id') id: string,
    @Body('resolution') resolution: string,
    @Req() req: any,
  ) {
    return this.adminService.resolveDispute(id, resolution, req.user.id);
  }

  @Post('operators/:operatorId/suspend')
  suspendOperator(
    @Param('operatorId') operatorId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.adminService.suspendOperator(operatorId, payload);
  }

  @Post('drivers/:driverId/suspend')
  suspendDriver(
    @Param('driverId') driverId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.adminService.suspendDriver(driverId, payload);
  }

  @Get('operators/leaderboard')
  getOperatorLeaderboard() {
    return this.adminService.getOperatorLeaderboard();
  }

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Get('businesses/pending')
  getPendingBusinesses() {
    return this.adminService.getPendingBusinesses();
  }

  @Post('businesses/:id/approve')
  approveBusiness(@Param('id') id: string) {
    return this.adminService.approveBusiness(id);
  }

  @Post('businesses/:id/reject')
  rejectBusiness(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.rejectBusiness(id, reason);
  }

  @Get('drivers/pending')
  getPendingDrivers() {
    return this.adminService.getPendingDrivers();
  }

  @Post('drivers/:id/approve')
  approveDriver(@Param('id') id: string) {
    return this.adminService.approveDriver(id);
  }

  @Post('drivers/:id/reject')
  rejectDriver(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.rejectDriver(id, reason);
  }

  // --- Orders ---

  @Get('orders')
  getAllOrders() {
    return this.adminService.getAllOrders();
  }

  @Get('orders/:id')
  getOrderDetails(@Param('id') id: string) {
    return this.adminService.getOrderDetails(id);
  }

  // --- Settings & Profile ---
  
  @Get('settings/profile')
  getAdminProfile(@Req() req: any) {
    return this.adminService.getAdminProfile(req.user.id);
  }

  @Patch('settings/profile')
  updateAdminProfile(@Req() req: any, @Body() data: any) {
    return this.adminService.updateAdminProfile(req.user.id, data);
  }

  @Post('settings/security/request-otp')
  requestSecurityOtp(@Req() req: any) {
    return this.adminService.requestSecurityOtp(req.user.id);
  }

  @Patch('settings/security/verify')
  verifySecurityOtp(@Req() req: any, @Body() data: any) {
    return this.adminService.verifySecurityOtp(req.user.id, data);
  }

  @Patch('settings/notifications')
  updateNotifications(@Req() req: any, @Body() data: any) {
    return this.adminService.updateNotifications(req.user.id, data);
  }

  @Get('settings/system')
  getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Patch('settings/system')
  updateSystemSettings(@Body() data: any) {
    return this.adminService.updateSystemSettings(data);
  }

  // --- Announcements ---
  
  @Get('announcements')
  getAnnouncements() {
    return this.adminService.getAnnouncements();
  }

  @Post('announcements')
  createAnnouncement(@Body() data: any) {
    return this.adminService.createAnnouncement(data);
  }

  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id') id: string) {
    return this.adminService.deleteAnnouncement(id);
  }
}
