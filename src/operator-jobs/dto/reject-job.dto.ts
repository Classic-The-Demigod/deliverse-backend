import { IsString, IsOptional } from 'class-validator';

export class RejectJobDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
