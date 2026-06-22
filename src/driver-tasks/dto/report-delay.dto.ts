import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportDelayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}
