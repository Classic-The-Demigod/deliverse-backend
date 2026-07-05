import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Roles(Role.USER, Role.OPERATOR, Role.ADMIN)
  @Post()
  create(@Req() req: any, @Body() payload: CreateDisputeDto) {
    return this.disputesService.create(req.user.id, req.user.role, payload);
  }

  @Roles(Role.USER, Role.OPERATOR, Role.ADMIN)
  @Get(':disputeId')
  findOne(@Param('disputeId') disputeId: string) {
    return this.disputesService.findOne(disputeId);
  }

  @Roles(Role.ADMIN)
  @Post(':disputeId/resolve')
  resolve(
    @Req() req: any,
    @Param('disputeId') disputeId: string,
    @Body() payload: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(disputeId, req.user.id, payload);
  }
}
