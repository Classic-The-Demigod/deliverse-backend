import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 1. Look for API Key in headers
    let apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    apiKey = apiKey.trim();

    const isSecret = apiKey.startsWith('dlv_sec_');

    if (!isSecret) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const keyHash = require('crypto').createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = await this.prisma.businessApiKey.findFirst({
      where: { keyHash },
      include: {
        business: {
          include: { user: true }
        }
      }
    });

    if (!keyRecord || keyRecord.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    if (!keyRecord.business.isApproved) {
      // Depending on rules, you might allow unapproved businesses to test in sandbox.
      // But for now:
      // throw new UnauthorizedException('Business is not yet approved to use the API.');
    }

    // Attach to request
    request.apiKey = keyRecord;
    request.businessProfile = keyRecord.business;
    request.user = keyRecord.business.user;

    return true;
  }
}
