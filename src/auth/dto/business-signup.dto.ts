import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class BusinessSignupDto {
  @IsEmail()
  email!: string;

  @IsPhoneNumber()
  phone!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  oauthToken?: string;

  @IsString()
  businessName!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsString()
  address!: string;
}
