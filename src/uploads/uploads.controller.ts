import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Public() // Can restrict to specific roles if needed, but often images are uploaded before full auth or during onboarding
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // You can enforce file type checks here
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a'
    ];
    if (!allowedMimeTypes.includes(file.mimetype) && !file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('Invalid file type');
    }

    const result = await this.uploadsService.uploadFile(file, 'deliverse');
    let url = result.secure_url;
    if (file.mimetype === 'audio/webm' || file.originalname?.endsWith('.webm') || url.endsWith('.webm')) {
      url = url.replace(/\.webm$/, '.mp3');
    }
    return {
      url,
      publicId: result.public_id,
      format: result.format,
    };
  }
}
