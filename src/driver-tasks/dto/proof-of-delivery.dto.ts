import { IsEnum, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';
import { DeliveryVerificationMethod } from '@prisma/client';

export class ProofOfDeliveryDto {
  @IsUrl({ require_tld: false })
  photoUrl!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsEnum(DeliveryVerificationMethod)
  verificationMethod!: DeliveryVerificationMethod;

  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  signatureUrl?: string;
}
