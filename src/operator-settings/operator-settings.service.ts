import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackService } from '../payments/providers/paystack.service';
import { LinkBankDto, UpdateOperatorBusinessDto, WithdrawFundsDto } from './dto/operator-settings.dto';

@Injectable()
export class OperatorSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        notifyDelivery: true,
        notifyPayment: true,
        notifyDispatch: true,
        notifyAnnouncements: true,
        operatorProfile: true,
        bankAccount: true,
        wallet: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return { user };
  }

  async updateBusiness(userId: string, payload: UpdateOperatorBusinessDto) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found.');
    }

    const updated = await this.prisma.operatorProfile.update({
      where: { id: operator.id },
      data: {
        ...(payload.companyName !== undefined && { companyName: payload.companyName }),
        ...(payload.rcNumber !== undefined && { rcNumber: payload.rcNumber }),
        ...(payload.address !== undefined && { address: payload.address }),
      },
    });

    return { message: 'Business profile updated.', operator: updated };
  }

  async listBanks() {
    return this.paystack.listBanks();
  }

  async verifyBankAccount(accountNumber: string, bankCode: string) {
    return this.paystack.resolveAccountNumber(accountNumber, bankCode);
  }

  async linkBankAccount(userId: string, dto: LinkBankDto) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { userId },
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
        },
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
      },
    });
  }

  async deleteBankAccount(userId: string) {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new BadRequestException('No bank account linked.');
    }

    await this.prisma.bankAccount.delete({
      where: { id: existing.id },
    });

    return { message: 'Bank account deleted.' };
  }

  async withdrawFunds(userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero.');
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId },
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
        data: { balance: { decrement: amount } },
      });

      const ref = `OP-WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: 'DEBIT',
          description: `Withdrawal to ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          reference: ref,
        },
      });

      return { success: true, message: 'Withdrawal successful', reference: ref };
    });
  }
}
