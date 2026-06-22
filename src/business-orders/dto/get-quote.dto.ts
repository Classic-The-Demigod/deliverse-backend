import { IsEnum, IsNumber, IsPositive } from 'class-validator';
import { UrgencyTier, VehicleType } from '@prisma/client';

export class GetQuoteDto {
  @IsNumber()
  @IsPositive()
  distanceKm!: number;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsEnum(UrgencyTier)
  urgency!: UrgencyTier;
}
