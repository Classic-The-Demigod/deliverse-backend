import { IsEmail } from 'class-validator';

export class DriverLoginDto {
  @IsEmail()
  email!: string;
}
