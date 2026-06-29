import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // Webhook Endpoints management is handled in DeveloperController

  @Public()
  @Post('paystack')
  handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.webhooksService.handlePaystackWebhook(signature, payload);
  }

  @Public()
  @Post('monnify')
  handleMonnifyWebhook(
    @Headers('monnify-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.webhooksService.handleMonnifyWebhook(signature, payload);
  }
}
