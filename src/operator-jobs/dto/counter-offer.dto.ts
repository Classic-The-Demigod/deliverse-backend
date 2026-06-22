import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CounterOfferDto {
  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
