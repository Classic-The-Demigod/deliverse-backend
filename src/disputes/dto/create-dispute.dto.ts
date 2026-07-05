import { IsString, IsEnum, IsOptional, IsArray, IsNotEmpty } from 'class-validator';
import { DisputeType } from '@prisma/client';

export class CreateDisputeDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(DisputeType)
  @IsNotEmpty()
  type: DisputeType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidence?: string[];
}
