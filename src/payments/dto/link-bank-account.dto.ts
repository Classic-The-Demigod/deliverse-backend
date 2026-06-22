import { IsString, Length } from 'class-validator';

export class LinkBankAccountDto {
  @IsString()
  bankCode!: string;

  @IsString()
  bankName!: string;

  @IsString()
  accountName!: string;

  @IsString()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber!: string;
}
