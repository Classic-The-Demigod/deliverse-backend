import { IsEmail, IsPhoneNumber } from 'class-validator';

export class InitiateOperatorSignupDto {
  @IsEmail()
  email!: string;

  @IsPhoneNumber()
  phone!: string;
}
