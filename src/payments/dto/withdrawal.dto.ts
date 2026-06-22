import { IsNumber, IsPositive } from 'class-validator';

export class WithdrawalDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}
