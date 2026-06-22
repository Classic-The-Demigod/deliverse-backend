import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class OperatorSignupDto {
  @IsEmail()
  email!: string;

  @IsPhoneNumber()
  phone!: string;

  @IsString()
  @MinLength(8)
  password!: string;

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
