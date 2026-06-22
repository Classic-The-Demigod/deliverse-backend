import { IsNumber } from 'class-validator';

export class LocationUpdateDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
