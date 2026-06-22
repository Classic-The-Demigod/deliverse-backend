import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class UserSignupDto {
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
  fullName!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  dob!: string; // MM/YY
}
