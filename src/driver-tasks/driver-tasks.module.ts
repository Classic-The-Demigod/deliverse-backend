import { Module } from '@nestjs/common';
import { DriverTasksController } from './driver-tasks.controller';
import { DriverTasksService } from './driver-tasks.service';
import { DriverEarningsController } from './driver-earnings.controller';
import { DriverEarningsService } from './driver-earnings.service';
import { DriverAnalyticsController } from './driver-analytics.controller';
import { DriverAnalyticsService } from './driver-analytics.service';
import { PaymentsModule } from '../payments/payments.module';
import { PaystackService } from '../payments/providers/paystack.service';

@Module({
  imports: [PaymentsModule],
  controllers: [DriverTasksController, DriverEarningsController, DriverAnalyticsController],
  providers: [DriverTasksService, DriverEarningsService, PaystackService, DriverAnalyticsService],
})
export class DriverTasksModule {}
