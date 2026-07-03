import { Controller, Get, Post, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DriverEarningsService } from './driver-earnings.service';

@Roles(Role.DRIVER)
@Controller('driver/earnings')
export class DriverEarningsController {
  constructor(private readonly driverEarningsService: DriverEarningsService) {}

  @Get()
  getEarnings(@CurrentUser('userId') userId: string) {
    return this.driverEarningsService.getEarnings(userId);
  }

  @Get('banks')
  getBanks() {
    return this.driverEarningsService.listBanks();
  }

  @Post('verify-bank')
  verifyBank(@Body() dto: { accountNumber: string; bankCode: string }) {
    return this.driverEarningsService.verifyBankAccount(dto.accountNumber, dto.bankCode);
  }

  @Post('link-bank')
  linkBank(
    @CurrentUser('userId') userId: string,
    @Body() dto: { bankName: string; bankCode: string; accountNumber: string; accountName: string }
  ) {
    return this.driverEarningsService.linkBankAccount(userId, dto);
  }

}
