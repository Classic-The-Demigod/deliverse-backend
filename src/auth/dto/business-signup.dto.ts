import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, IsUrl, MinLength } from 'class-validator';
import { BusinessCategory } from '@prisma/client';

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

  @IsUrl({ require_tld: false })
  website!: string;

  @IsEnum(BusinessCategory)
  category!: BusinessCategory;
}
