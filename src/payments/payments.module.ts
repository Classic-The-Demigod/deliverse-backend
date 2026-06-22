import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackService } from './providers/paystack.service';
import { MonnifyService } from './providers/monnify.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackService, MonnifyService],
  exports: [PaymentsService, PaystackService],
})
export class PaymentsModule {}
