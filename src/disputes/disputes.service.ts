import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Role } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, role: Role, payload: CreateDisputeDto) {
    // Verify the order exists
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if a dispute already exists for this order
    const existingDispute = await this.prisma.dispute.findUnique({
      where: { orderId: payload.orderId },
    });

    if (existingDispute) {
      throw new BadRequestException('A dispute already exists for this order');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId: payload.orderId,
        type: payload.type,
        description: payload.description,
        evidence: payload.evidence || [],
        raisedById: userId,
        raisedByRole: role,
        status: 'OPEN',
      },
    });

    return dispute;
  }

  async findOne(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: true,
        resolvedBy: {
          select: { fullName: true },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  async resolve(disputeId: string, adminId: string, payload: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const adminProfile = await this.prisma.adminProfile.findUnique({
      where: { userId: adminId },
    });

    if (!adminProfile) {
      throw new BadRequestException('Admin profile not found');
    }

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolution: payload.resolution,
        resolvedById: adminProfile.id,
        resolvedAt: new Date(),
      },
    });
  }
}
