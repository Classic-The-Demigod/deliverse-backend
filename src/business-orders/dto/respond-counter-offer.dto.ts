// ---------------------------------------------------------------------------
// respond-counter-offer.dto.ts
// ---------------------------------------------------------------------------
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RespondCounterOfferDto {
  @IsBoolean()
    accept!: boolean;

  // Optional note only makes sense on rejection
  @IsOptional()
  @IsString()
  note?: string;
}
