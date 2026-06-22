import { IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class CompleteOperatorProfileDto {
  @IsString()
  companyName!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  rcNumber?: string;

  @IsOptional()
  @IsPhoneNumber()
  supportPhone?: string;
}
