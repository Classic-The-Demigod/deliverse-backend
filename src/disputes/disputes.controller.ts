import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisputesService } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Roles(Role.USER, Role.OPERATOR, Role.ADMIN)
  @Post()
  create(@Body() payload: Record<string, unknown>) {
    return this.disputesService.create(payload);
  }

  @Roles(Role.USER, Role.OPERATOR, Role.ADMIN)
  @Get(':disputeId')
  findOne(@Param('disputeId') disputeId: string) {
    return this.disputesService.findOne(disputeId);
  }

  @Roles(Role.ADMIN)
  @Post(':disputeId/resolve')
  resolve(
    @Param('disputeId') disputeId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.disputesService.resolve(disputeId, payload);
  }
}
