import { IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class PickupProofDto {
  @IsUrl({ require_tld: false })
  photoUrl!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
