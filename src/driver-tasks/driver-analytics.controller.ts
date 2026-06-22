import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DriverAnalyticsService } from './driver-analytics.service';

@Roles(Role.DRIVER)
@Controller('driver/analytics')
export class DriverAnalyticsController {
  constructor(private readonly analyticsService: DriverAnalyticsService) {}

  @Get()
  getAnalytics(@CurrentUser('userId') userId: string) {
    return this.analyticsService.getAnalytics(userId);
  }
}
