import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Roles(Role.USER) // We use USER role for businesses as per current schema
@Controller('business/developer')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get('keys')
  getApiKeys(@CurrentUser('userId') userId: string) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.getApiKeys(userId);
  }

  @Post('keys')
  generateApiKey(
    @CurrentUser('userId') userId: string,
    @Body('name') name: string,
  ) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.generateApiKeys(userId, name);
  }

  @Delete('keys/:id')
  revokeApiKey(
    @CurrentUser('userId') userId: string,
    @Param('id') keyId: string,
  ) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.revokeApiKey(userId, keyId);
  }

  @Get('webhooks')
  getWebhooks(@CurrentUser('userId') userId: string) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.getWebhooks(userId);
  }

  @Post('webhooks')
  createWebhook(
    @CurrentUser('userId') userId: string,
    @Body('url') url: string,
    @Body('description') description?: string,
  ) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.createWebhook(userId, url, description);
  }

  @Delete('webhooks/:id')
  deleteWebhook(
    @CurrentUser('userId') userId: string,
    @Param('id') webhookId: string,
  ) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.deleteWebhook(userId, webhookId);
  }

  @Get('settings')
  getDeveloperSettings(@CurrentUser('userId') userId: string) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.getDeveloperSettings(userId);
  }

  @Post('settings/domains')
  updateAllowedDomains(
    @CurrentUser('userId') userId: string,
    @Body('domains') domains: string[],
  ) {
    if (!userId) throw new Error('Not authenticated');
    return this.developerService.updateAllowedDomains(userId, domains);
  }
}
