import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class DeveloperService {
  constructor(private prisma: PrismaService) {}

  private generateKey(prefix: string): string {
    return `${prefix}_${randomBytes(24).toString('hex')}`;
  }

  private async getBusinessId(userId: string): Promise<string> {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Business profile not found');
    return profile.id;
  }

  // --- API Keys ---

  async getApiKeys(userId: string) {
    const businessId = await this.getBusinessId(userId);
    const keys = await this.prisma.businessApiKey.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    
    // Mask key hashes for security in the response
    return keys.map(k => ({
      ...k,
      keyHash: undefined,
    }));
  }

  async generateApiKeys(userId: string, name: string = 'Default Key') {
    const businessId = await this.getBusinessId(userId);
    // Generate a pair (we'll just use one secret key for now as requested by typical widget flow)
    const secretKey = this.generateKey('dlv_sec');
    const prefix = secretKey.substring(0, 12);
    const keyHash = createHash('sha256').update(secretKey).digest('hex');

    // Save to DB
    const keyRecord = await this.prisma.businessApiKey.create({
      data: {
        businessId,
        prefix,
        keyHash,
        name,
      },
    });

    return {
      id: keyRecord.id,
      name: keyRecord.name,
      prefix: keyRecord.prefix,
      secretKey: secretKey, // The ONLY time we return the secret key in plain text
      status: keyRecord.status,
      createdAt: keyRecord.createdAt,
    };
  }

  async revokeApiKey(userId: string, keyId: string) {
    const businessId = await this.getBusinessId(userId);
    const key = await this.prisma.businessApiKey.findUnique({ where: { id: keyId } });
    if (!key || key.businessId !== businessId) {
      throw new NotFoundException('API Key not found');
    }
    await this.prisma.businessApiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' },
    });
    return { success: true };
  }

  // --- Webhooks ---

  async getWebhooks(userId: string) {
    const businessId = await this.getBusinessId(userId);
    return this.prisma.webhookEndpoint.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(userId: string, url: string, description?: string) {
    const businessId = await this.getBusinessId(userId);
    const secret = this.generateKey('whsec');
    const webhook = await this.prisma.webhookEndpoint.create({
      data: {
        businessId,
        url,
        secret,
        isActive: true,
      },
    });
    return webhook;
  }

  async deleteWebhook(userId: string, webhookId: string) {
    const businessId = await this.getBusinessId(userId);
    const webhook = await this.prisma.webhookEndpoint.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.businessId !== businessId) {
      throw new NotFoundException('Webhook not found');
    }
    await this.prisma.webhookEndpoint.delete({ where: { id: webhookId } });
    return { success: true };
  }

  async getDeveloperSettings(userId: string) {
    const businessId = await this.getBusinessId(userId);
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
      select: { allowedDomains: true },
    });
    return profile;
  }

  async updateAllowedDomains(userId: string, domains: string[]) {
    const businessId = await this.getBusinessId(userId);
    const profile = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: { allowedDomains: domains },
      select: { allowedDomains: true },
    });
    return profile;
  }
}
