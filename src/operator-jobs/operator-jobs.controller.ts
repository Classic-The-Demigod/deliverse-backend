import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OperatorJobsService } from './operator-jobs.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CounterOfferDto } from './dto/counter-offer.dto';
import { RejectJobDto } from './dto/reject-job.dto';

@Roles(Role.OPERATOR)
@Controller('operator/jobs')
export class OperatorJobsController {
  constructor(private readonly operatorJobsService: OperatorJobsService) {}

  @Get('incoming')
  findIncomingJobs(@CurrentUser('userId') userId: string) {
    return this.operatorJobsService.findIncomingJobs(userId);
  }

  @Get('active')
  getActiveDeliveries(@CurrentUser('userId') userId: string) {
    return this.operatorJobsService.getActiveDeliveries(userId);
  }

  @Get(':orderId')
  getOrderDetails(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.operatorJobsService.getOrderDetails(userId, orderId);
  }

  @Post(':orderId/accept')
  accept(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.operatorJobsService.accept(userId, orderId);
  }

  @Post(':orderId/reject')
  reject(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: RejectJobDto,
  ) {
    return this.operatorJobsService.reject(userId, orderId, payload);
  }

  @Post(':orderId/counter-offer')
  counterOffer(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: CounterOfferDto,
  ) {
    return this.operatorJobsService.counterOffer(userId, orderId, payload);
  }

  @Post(':orderId/assign-driver')
  assignDriver(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: AssignDriverDto,
  ) {
    return this.operatorJobsService.assignDriver(userId, orderId, payload);
  }

  @Post(':orderId/reassign-driver')
  reassignDriver(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: AssignDriverDto,
  ) {
    return this.operatorJobsService.reassignDriver(userId, orderId, payload);
  }

  @Post(':orderId/broadcast')
  broadcast(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.operatorJobsService.broadcast(userId, orderId);
  }
}
