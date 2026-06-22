import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { OperatorPricingService } from './operator-pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('operator/settings/pricing')
@Roles(Role.OPERATOR)
export class OperatorPricingController {
  constructor(private readonly pricingService: OperatorPricingService) {}

  @Get()
  getPricingConfigs(@CurrentUser('userId') userId: string) {
    return this.pricingService.getPricingConfigs(userId);
  }

  @Post()
  updatePricingConfig(
    @CurrentUser('userId') userId: string,
    @Body() dto: any,
  ) {
    return this.pricingService.updatePricingConfig(userId, dto);
  }
}
