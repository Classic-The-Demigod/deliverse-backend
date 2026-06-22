import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { LinkBankAccountDto } from './dto/link-bank-account.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(Role.USER)
  @Post('initialize')
  initializePayment(
    @CurrentUser('userId') userId: string,
    @Body() payload: InitializePaymentDto,
  ) {
    return this.paymentsService.initializePayment(userId, payload);
  }

  @Roles(Role.OPERATOR)
  @Get('earnings/summary')
  getEarningsSummary(@CurrentUser('userId') userId: string) {
    return this.paymentsService.getEarningsSummary(userId);
  }

  @Roles(Role.OPERATOR)
  @Get('earnings/transactions')
  getTransactions(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getTransactions(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(Role.OPERATOR)
  @Post('bank-accounts')
  linkBankAccount(
    @CurrentUser('userId') userId: string,
    @Body() payload: LinkBankAccountDto,
  ) {
    return this.paymentsService.linkBankAccount(userId, payload);
  }

  @Roles(Role.OPERATOR)
  @Get('bank-accounts')
  getBankAccount(@CurrentUser('userId') userId: string) {
    return this.paymentsService.getBankAccount(userId);
  }

  @Roles(Role.OPERATOR)
  @Post('withdraw')
  requestWithdrawal(
    @CurrentUser('userId') userId: string,
    @Body() payload: WithdrawalDto,
  ) {
    return this.paymentsService.requestWithdrawal(userId, payload);
  }
}
