import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Roles(Role.USER)
  @Post('endpoints')
  createEndpoint(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.createEndpoint(payload);
  }

  @Roles(Role.USER)
  @Get('endpoints')
  listEndpoints() {
    return this.webhooksService.listEndpoints();
  }

  @Roles(Role.USER)
  @Get('endpoints/:endpointId/deliveries')
  listDeliveries(@Param('endpointId') endpointId: string) {
    return this.webhooksService.listDeliveries(endpointId);
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
