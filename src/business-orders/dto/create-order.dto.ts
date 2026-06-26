// ---------------------------------------------------------------------------
// create-order.dto.ts
// ---------------------------------------------------------------------------
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsPhoneNumber,
  Min,
  Max,
  IsDecimal,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { PackageSensitivity, UrgencyTier, VehicleType } from '@prisma/client';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  merchantReference?: string;

  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsEnum(VehicleType)
    vehicleType!: VehicleType;

  @IsOptional()
  @IsEnum(PackageSensitivity)
  sensitivity?: PackageSensitivity;

  @IsEnum(UrgencyTier)
  urgency!: UrgencyTier;

  @IsString()
  @IsNotEmpty()
  packageName!: string;

  // Package dimensions
  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  heightCm?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  packageImageUrl!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  declaredItemValue?: number;

  @IsOptional()
  @IsString()
  handlingNotes?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsString()
  pickupPasscode?: string;

  @IsOptional()
  @IsString()
  dropoffPasscode?: string;

  @IsOptional()
  @IsString()
  customOrderCategory?: string;

  @IsOptional()
  @IsString()
  orderReference?: string;

  // Pickup
  @IsString()
    pickupAddress!: string;

  @IsNumber()
    pickupLatitude!: number;

  @IsNumber()
    pickupLongitude!: number;

  @IsString()
    pickupContactName!: string;

  @IsString()
    pickupContactPhone!: string;

  @IsOptional()
  @IsString()
  pickupZoneId?: string;

  // Dropoff
  @IsString()
    dropoffAddress!: string;

  @IsNumber()
    dropoffLatitude!: number;

  @IsNumber()
    dropoffLongitude!: number;

  @IsString()
    recipientName!: string;

  @IsString()
    recipientPhone!: string;

  @IsOptional()
  @IsString()
  dropoffZoneId?: string;

  // Pricing
  @IsNumber()
    @IsPositive()
    quotedPrice!: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceKm?: number;

  // Scheduling — only relevant for SCHEDULED urgency
  @ValidateIf((o) => o.urgency === UrgencyTier.SCHEDULED)
  @IsNotEmpty()
  @IsISO8601()
  scheduledFor?: string;
}
