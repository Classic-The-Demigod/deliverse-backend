import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { BusinessOrdersService } from './business-orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetQuoteDto } from './dto/get-quote.dto';
import { PaymentsService } from '../payments/payments.service';
import { InitializePaymentDto } from '../payments/dto/initialize-payment.dto';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(ApiKeyGuard)
@Controller('api/v1/checkout')
export class CheckoutApiController {
  constructor(
    private readonly businessOrdersService: BusinessOrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('business-info')
  getBusinessInfo(@Req() req: any) {
    // Only public keys or secret keys can access this
    const business = req.businessProfile;
    return {
      businessName: business.businessName,
      website: business.website,
      category: business.category,
      logoUrl: business.user.profilePicture, // Assuming profilePicture might exist
    };
  }

  @Post('quote')
  getQuote(@Req() req: any, @Body() payload: GetQuoteDto) {
    // The widget uses the public key to get a quote
    return this.businessOrdersService.getQuote(payload);
  }

  @Post('orders')
  createOrder(@Req() req: any, @Body() payload: CreateOrderDto) {
    // Requires secret key to create an order, or public key if we allow client-side creation.
    // For MVP checkout widget, if we only expose public keys in the JS snippet,
    // we must allow public keys to create orders, OR the business must create the order from their backend.
    // If the widget creates the order directly, public key must be allowed.
    // We will allow both for MVP but strictly checking if apiKey is valid.
    
    // Create the order associated with this business profile's user.
    return this.businessOrdersService.create(req.user.id, payload);
  }

  @Post('payments/initialize')
  initializePayment(@Req() req: any, @Body() payload: InitializePaymentDto) {
    // Uses the business's user.id so the PaymentsService can find the order
    return this.paymentsService.initializePayment(req.user.id, payload);
  }

  @Get('orders/:reference/status')
  async getOrderStatusByReference(@Req() req: any, @Param('reference') reference: string) {
    // Allows the widget to verify if a payment reference was successful
    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: reference },
      include: { order: true }
    });

    if (!payment || payment.order.userId !== req.user.id) {
      throw new NotFoundException('Payment/Order not found');
    }

    return {
      orderId: payment.orderId,
      status: payment.order.status,
      paymentStatus: payment.status,
    };
  }
}
