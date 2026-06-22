import { Module } from '@nestjs/common';
import { OperatorPricingController } from './operator-pricing.controller';
import { OperatorPricingService } from './operator-pricing.service';
import { OperatorSettingsController } from './operator-settings.controller';
import { OperatorSettingsService } from './operator-settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [OperatorPricingController, OperatorSettingsController],
  providers: [OperatorPricingService, OperatorSettingsService],
})
export class OperatorSettingsModule {}
