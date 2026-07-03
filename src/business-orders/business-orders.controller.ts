import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BusinessOrdersService } from './business-orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RespondCounterOfferDto } from './dto/respond-counter-offer.dto';
import { GetQuoteDto } from './dto/get-quote.dto';

@Roles(Role.USER) // all routes in this controller require the USER role (business accounts)
@Controller('business/orders')
export class BusinessOrdersController {
  constructor(private readonly businessOrdersService: BusinessOrdersService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('quote')
  getQuote(@Body() payload: GetQuoteDto) {
    return this.businessOrdersService.getQuote(payload);
  }

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() payload: CreateOrderDto,
  ) {
    return this.businessOrdersService.create(userId, payload);
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: ListOrdersDto,
  ) {
    return this.businessOrdersService.findAll(userId, query);
  }

  @Get(':orderId')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.businessOrdersService.findOne(userId, orderId);
  }

  @Patch(':orderId/cancel')
  cancel(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: CancelOrderDto,
  ) {
    return this.businessOrdersService.cancel(userId, orderId, payload);
  }

  @Patch(':orderId/counter-offer/respond')
  respondToCounterOffer(
    @CurrentUser('userId') userId: string,
    @Param('orderId') orderId: string,
    @Body() payload: RespondCounterOfferDto,
  ) {
    return this.businessOrdersService.respondToCounterOffer(
      userId,
      orderId,
      payload,
    );
  }
}
