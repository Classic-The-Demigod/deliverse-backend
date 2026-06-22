import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OperatorDashboardService } from './operator-dashboard.service';

@Roles(Role.OPERATOR)
@Controller('operator/dashboard')
export class OperatorDashboardController {
  constructor(private readonly operatorDashboardService: OperatorDashboardService) {}

  @Get('stats')
  getDashboardStats(
    @CurrentUser('userId') userId: string,
    @Query('filter') filter?: string,
  ) {
    return this.operatorDashboardService.getDashboardStats(userId, filter || 'month');
  }
}
