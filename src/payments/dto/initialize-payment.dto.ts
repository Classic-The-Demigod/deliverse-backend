import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export enum PaymentMethod {
  NEW_CARD = 'NEW_CARD',
  SAVED_CARD = 'SAVED_CARD',
}

export class InitializePaymentDto {
  @IsString()
  orderId!: string;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsUUID()
  savedCardId?: string;
}
