import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { OperatorFleetService } from './operator-fleet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('operator/fleet')
@Roles(Role.OPERATOR)
export class OperatorFleetController {
  constructor(private readonly fleetService: OperatorFleetService) {}

  @Get()
  getFleet(@CurrentUser('userId') userId: string) {
    return this.fleetService.getFleet(userId);
  }

  @Post('vehicles')
  addVehicle(
    @CurrentUser('userId') userId: string,
    @Body() dto: any,
  ) {
    return this.fleetService.addVehicle(userId, dto);
  }

  @Post('invite')
  inviteDriver(
    @CurrentUser('userId') userId: string,
    @Body() dto: any,
  ) {
    return this.fleetService.inviteDriver(userId, dto);
  }

  @Put('vehicles/:id')
  updateVehicle(
    @CurrentUser('userId') userId: string,
    @Param('id') vehicleId: string,
    @Body() dto: any,
  ) {
    return this.fleetService.updateVehicle(userId, vehicleId, dto);
  }

  @Delete('vehicles/:id')
  deleteVehicle(
    @CurrentUser('userId') userId: string,
    @Param('id') vehicleId: string,
  ) {
    return this.fleetService.deleteVehicle(userId, vehicleId);
  }

  @Put('drivers/:id')
  updateDriver(
    @CurrentUser('userId') userId: string,
    @Param('id') driverId: string,
    @Body() dto: any,
  ) {
    return this.fleetService.updateDriver(userId, driverId, dto);
  }
}
