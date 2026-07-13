import { Body, Controller, Get, Param, Post, Headers, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // Webhook Endpoints management is handled in DeveloperController

  @Public()
  @Post('internal-dispatch')
  async handleInternalDispatch(
    @Body() payload: any,
    @Headers('x-deliverse-endpoint-id') endpointId: string,
    @Headers('x-deliverse-event') event: string,
  ) {
    if (!endpointId || !event) {
      throw new BadRequestException('Missing required headers');
    }
    // We expect this endpoint to be called by Cloud Tasks.
    // In production, we'd add authentication (e.g. validating OIDC token from Cloud Tasks),
    // but for now we accept the payload and execute.
    return this.webhooksService.executeWebhookDelivery(endpointId, event as any, payload);
  }

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
