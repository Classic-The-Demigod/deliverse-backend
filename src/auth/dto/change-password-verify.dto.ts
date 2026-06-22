import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordVerifyDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  newPassword!: string;
}
