import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateOperatorBusinessDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  rcNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  driverEarningsDisplayPercentage?: number;
}

export class LinkBankDto {
  @IsNotEmpty()
  @IsString()
  accountNumber!: string;

  @IsNotEmpty()
  @IsString()
  bankCode!: string;

  @IsNotEmpty()
  @IsString()
  bankName!: string;

  @IsNotEmpty()
  @IsString()
  accountName!: string;
}

export class WithdrawFundsDto {
  @IsNotEmpty()
  @IsNumber()
  amount!: number;
}
