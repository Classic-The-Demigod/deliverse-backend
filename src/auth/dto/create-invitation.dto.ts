import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEnum(Role)
  role!: Role;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  operatorId?: string;

  @IsOptional()
  @IsString()
  invitedByUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}
