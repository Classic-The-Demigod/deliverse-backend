import { DocumentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

class OnboardingDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsUrl({
    require_tld: false,
  })
  fileUrl!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OnboardingDocumentDto)
  documents!: OnboardingDocumentDto[];
}
