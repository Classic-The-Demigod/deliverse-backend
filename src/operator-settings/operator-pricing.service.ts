import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleType } from '@prisma/client';

@Injectable()
export class OperatorPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPricingConfigs(userId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!operator) throw new NotFoundException('Operator not found');

    return this.prisma.pricingConfig.findMany({
      where: { operatorId: operator.id },
    });
  }

  async updatePricingConfig(userId: string, dto: { vehicleType: VehicleType, urgencyTier: import('@prisma/client').UrgencyTier, baseFare: number, perKmRate: number, isActive?: boolean }) {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!operator) throw new NotFoundException('Operator not found');

    return this.prisma.pricingConfig.upsert({
      where: {
        operatorId_vehicleType_urgencyTier: {
          operatorId: operator.id,
          vehicleType: dto.vehicleType,
          urgencyTier: dto.urgencyTier
        }
      },
      update: {
        baseFare: dto.baseFare,
        perKmRate: dto.perKmRate,
        isActive: dto.isActive !== undefined ? dto.isActive : true
      },
      create: {
        operatorId: operator.id,
        vehicleType: dto.vehicleType,
        urgencyTier: dto.urgencyTier,
        baseFare: dto.baseFare,
        perKmRate: dto.perKmRate,
        isActive: dto.isActive !== undefined ? dto.isActive : true
      }
    });
  }
}
