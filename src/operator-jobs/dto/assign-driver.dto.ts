import { IsString, IsOptional } from 'class-validator';

export class AssignDriverDto {
  @IsString()
  driverId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
