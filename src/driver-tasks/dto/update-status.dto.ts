import { IsEnum } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(DriverStatus, { message: 'Status must be a valid DriverStatus (e.g., IDLE, ACTIVE, OFFLINE)' })
  status!: DriverStatus;
}
