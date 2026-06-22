import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DriverTasksService } from './driver-tasks.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { PickupProofDto } from './dto/pickup-proof.dto';
import { ProofOfDeliveryDto } from './dto/proof-of-delivery.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReportDelayDto } from './dto/report-delay.dto';

@Roles(Role.DRIVER)
@Controller('driver/tasks')
export class DriverTasksController {
  constructor(private readonly driverTasksService: DriverTasksService) {}

  @Get('active')
  findActiveTask(@CurrentUser('userId') userId: string) {
    return this.driverTasksService.findActiveTask(userId);
  }

  @Patch('status')
  updateStatus(
    @CurrentUser('userId') userId: string,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.driverTasksService.updateStatus(userId, payload);
  }

  @Patch('location')
  updateLocation(
    @CurrentUser('userId') userId: string,
    @Body() payload: LocationUpdateDto,
  ) {
    return this.driverTasksService.updateLocation(userId, payload);
  }

  @Get('broadcasts')
  @Roles(Role.DRIVER)
  findBroadcasts(@CurrentUser('userId') userId: string) {
    return this.driverTasksService.findBroadcasts(userId);
  }

  @Get('ongoing')
  @Roles(Role.DRIVER)
  findOngoingTasks(@CurrentUser('userId') userId: string) {
    return this.driverTasksService.findOngoingTasks(userId);
  }

  @Get('history')
  @Roles(Role.DRIVER)
  findDriverTasksHistory(@CurrentUser('userId') userId: string) {
    return this.driverTasksService.findDriverTasksHistory(userId);
  }

  @Post(':orderId/accept')
  acceptOrder(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.driverTasksService.acceptOrder(userId, orderId);
  }

  @Post(':orderId/accept-assignment')
  acceptAssignment(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.driverTasksService.acceptAssignment(userId, orderId);
  }

  @Post(':orderId/decline-assignment')
  declineAssignment(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.driverTasksService.declineAssignment(userId, orderId);
  }

  @Post(':orderId/arrive-pickup')
  arrivePickup(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: LocationUpdateDto,
  ) {
    return this.driverTasksService.arrivePickup(userId, orderId, payload);
  }

  @Post(':orderId/pickup')
  pickup(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: PickupProofDto,
  ) {
    return this.driverTasksService.pickup(userId, orderId, payload);
  }

  @Post(':orderId/arrive-destination')
  arriveDestination(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: LocationUpdateDto,
  ) {
    return this.driverTasksService.arriveDestination(userId, orderId, payload);
  }

  @Post(':orderId/deliver')
  deliver(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: ProofOfDeliveryDto,
  ) {
    return this.driverTasksService.deliver(userId, orderId, payload);
  }

  @Post(':orderId/report-issue')
  reportIssue(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: Record<string, unknown>, // Keeping generic for now, outside of MVP scope
  ) {
    return this.driverTasksService.reportIssue(userId, orderId, payload);
  }

  @Post(':orderId/delay')
  reportDelay(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: ReportDelayDto,
  ) {
    return this.driverTasksService.reportDelay(userId, orderId, payload);
  }
}
