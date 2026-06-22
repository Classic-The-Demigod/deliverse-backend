import { Module } from '@nestjs/common';
import { OperatorFleetController } from './operator-fleet.controller';
import { OperatorFleetService } from './operator-fleet.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OperatorFleetController],
  providers: [OperatorFleetService],
})
export class OperatorFleetModule {}
