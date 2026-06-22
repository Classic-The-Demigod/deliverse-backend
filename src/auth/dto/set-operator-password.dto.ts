import { IsString, MinLength } from 'class-validator';

export class SetOperatorPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
