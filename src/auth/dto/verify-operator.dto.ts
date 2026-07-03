import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyOperatorDto {
  @IsString()
  @IsNotEmpty()
  rcNumber: string;

  @IsString()
  @IsNotEmpty()
  nin: string;
}
