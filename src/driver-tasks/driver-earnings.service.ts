import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackService } from '../payments/providers/paystack.service';

@Injectable()
export class DriverEarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async getEarnings(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { operator: true },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found.');
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId }
    });

    // We fetch ratings to calculate avg rating and return recent reviews
    const ratings = await this.prisma.rating.findMany({
      where: { driverId: driver.id },
      include: {
        order: {
          select: {
            user: { select: { fullName: true, avatarUrl: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const activeOrdersCount = await this.prisma.order.count({
      where: {
        driverId: driver.id,
        status: {
          in: ['ASSIGNED', 'ARRIVED_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_DESTINATION']
        }
      }
    });

    const completedOrders = await this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: 'DELIVERED'
      },
      select: {
        finalPrice: true,
        actualDeliveredAt: true,
      }
    });
    
    const completedRidesCount = completedOrders.length;

    // Calculate this month's earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const percentageMultiplier = (driver.operator?.driverEarningsDisplayPercentage || 0) / 100;
    
    let totalEarned = 0;
    let monthlyEarned = 0;

    completedOrders.forEach(order => {
      const orderValue = Number(order.finalPrice || 0) * percentageMultiplier;
      totalEarned += orderValue;
      if (order.actualDeliveredAt && order.actualDeliveredAt >= startOfMonth) {
        monthlyEarned += orderValue;
      }
    });
    
    let totalRating = 0;
    ratings.forEach(r => totalRating += r.score);
    const avgRating = ratings.length > 0 ? (totalRating / ratings.length).toFixed(1) : '-';

    return {
      data: {
        totalEarned,
        monthlyEarned,
        activeOrdersCount,
        completedRidesCount,
        avgRating,
        hasLinkedAccount: !!bankAccount,
        recentReviews: ratings.map(r => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          createdAt: r.createdAt,
          reviewerName: r.order?.user?.fullName || 'Anonymous',
          reviewerAvatar: r.order?.user?.avatarUrl
        }))
      }
    };
  }

  async listBanks() {
    return this.paystack.listBanks();
  }

  async verifyBankAccount(accountNumber: string, bankCode: string) {
    return this.paystack.resolveAccountNumber(accountNumber, bankCode);
  }

  async linkBankAccount(userId: string, dto: { bankName: string; bankCode: string; accountNumber: string; accountName: string }) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { userId }
    });

    if (existing) {
      return this.prisma.bankAccount.update({
        where: { id: existing.id },
        data: {
          bankName: dto.bankName,
          bankCode: dto.bankCode,
          accountNumber: dto.accountNumber,
          accountName: dto.accountName,
          isVerified: true,
        }
      });
    }

    return this.prisma.bankAccount.create({
      data: {
        userId,
        bankName: dto.bankName,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        isVerified: true,
      }
    });
  }

}
