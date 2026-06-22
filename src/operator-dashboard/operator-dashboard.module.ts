import { Module } from '@nestjs/common';
import { OperatorDashboardController } from './operator-dashboard.controller';
import { OperatorDashboardService } from './operator-dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OperatorDashboardController],
  providers: [OperatorDashboardService],
})
export class OperatorDashboardModule {}
