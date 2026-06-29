import { Module } from '@nestjs/common';
import { BusinessOrdersController } from './business-orders.controller';
import { CheckoutApiController } from './checkout-api.controller';
import { BusinessOrdersService } from './business-orders.service';
import { DispatchCron } from './cron/dispatch.cron';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [BusinessOrdersController, CheckoutApiController],
  providers: [BusinessOrdersService, DispatchCron],
})
export class BusinessOrdersModule {}
