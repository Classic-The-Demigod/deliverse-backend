import { Module } from '@nestjs/common';
import { OperatorJobsController } from './operator-jobs.controller';
import { OperatorJobsService } from './operator-jobs.service';

@Module({
  controllers: [OperatorJobsController],
  providers: [OperatorJobsService],
})
export class OperatorJobsModule {}
