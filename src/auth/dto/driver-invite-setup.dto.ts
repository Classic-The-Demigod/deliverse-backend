import { IsEmail } from 'class-validator';

export class DriverInviteSetupDto {
  @IsEmail()
  email!: string;
}
