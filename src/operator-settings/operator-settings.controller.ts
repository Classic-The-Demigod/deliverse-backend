import { Controller, Get, Patch, Post, Body, Delete } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OperatorSettingsService } from './operator-settings.service';
import { LinkBankDto, UpdateOperatorBusinessDto, WithdrawFundsDto } from './dto/operator-settings.dto';

@Roles(Role.OPERATOR)
@Controller('operator/settings')
export class OperatorSettingsController {
  constructor(private readonly operatorSettingsService: OperatorSettingsService) {}

  @Get('profile')
  getProfile(@CurrentUser('userId') userId: string) {
    return this.operatorSettingsService.getProfile(userId);
  }

  @Get('platform-fee')
  getPlatformFee() {
    return this.operatorSettingsService.getPlatformFee();
  }

  @Patch('business')
  updateBusiness(
    @CurrentUser('userId') userId: string,
    @Body() payload: UpdateOperatorBusinessDto,
  ) {
    return this.operatorSettingsService.updateBusiness(userId, payload);
  }

  @Get('banks')
  getBanks() {
    return this.operatorSettingsService.listBanks();
  }

  @Post('bank/verify')
  verifyBank(@Body() dto: { accountNumber: string; bankCode: string }) {
    return this.operatorSettingsService.verifyBankAccount(dto.accountNumber, dto.bankCode);
  }

  @Post('bank')
  linkBank(
    @CurrentUser('userId') userId: string,
    @Body() dto: LinkBankDto,
  ) {
    return this.operatorSettingsService.linkBankAccount(userId, dto);
  }

  @Delete('bank')
  deleteBank(@CurrentUser('userId') userId: string) {
    return this.operatorSettingsService.deleteBankAccount(userId);
  }

  @Post('withdraw')
  withdraw(
    @CurrentUser('userId') userId: string,
    @Body() dto: WithdrawFundsDto,
  ) {
    return this.operatorSettingsService.withdrawFunds(userId, dto.amount);
  }
}
