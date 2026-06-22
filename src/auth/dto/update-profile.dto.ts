import { IsOptional, IsString, Matches, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  notifyDelivery?: boolean;

  @IsOptional()
  notifyPayment?: boolean;

  @IsOptional()
  notifyDispatch?: boolean;

  @IsOptional()
  notifyAnnouncements?: boolean;
}
