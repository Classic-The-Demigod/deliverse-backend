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
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found.');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

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

    const completedRidesCount = await this.prisma.order.count({
      where: {
        driverId: driver.id,
        status: 'DELIVERED'
      }
    });

    // Calculate this month's earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyTransactions = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet?.id,
        type: 'CREDIT',
        createdAt: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    const totalEarned = wallet ? Number(wallet.balance) : 0;
    const monthlyEarned = monthlyTransactions._sum.amount ? Number(monthlyTransactions._sum.amount) : 0;
    
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

  async withdrawFunds(userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero.');
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId }
    });
    if (!bankAccount) {
      throw new BadRequestException('You must link a bank account before withdrawing.');
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance.toNumber() < amount) {
        throw new BadRequestException('Insufficient balance.');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } }
      });

      const ref = `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: 'DEBIT',
          description: `Withdrawal to ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          reference: ref
        }
      });

      return { success: true, message: 'Withdrawal successful', reference: ref };
    });
  }
}
