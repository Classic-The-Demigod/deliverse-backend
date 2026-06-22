import { Module } from '@nestjs/common';
import { BusinessOrdersController } from './business-orders.controller';
import { BusinessOrdersService } from './business-orders.service';
import { DispatchCron } from './cron/dispatch.cron';

@Module({
  controllers: [BusinessOrdersController],
  providers: [BusinessOrdersService, DispatchCron],
})
export class BusinessOrdersModule {}
