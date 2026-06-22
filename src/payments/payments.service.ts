import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionType, SettlementStatus, PaymentProvider } from '@prisma/client';
import { LinkBankAccountDto } from './dto/link-bank-account.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { InitializePaymentDto, PaymentMethod } from './dto/initialize-payment.dto';
import { PaystackService } from './providers/paystack.service';
import { MonnifyService } from './providers/monnify.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackService: PaystackService,
    private readonly monnifyService: MonnifyService,
  ) {}

  private async getOperatorWallet(userId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: { wallet: true },
    });

    if (!operator) throw new NotFoundException('Operator profile not found.');
    if (!operator.wallet) throw new NotFoundException('Wallet not found for this operator.');

    return { operator, wallet: operator.wallet };
  }

  async initializePayment(userId: string, payload: InitializePaymentDto) {
    // 1. Validate Order
    const order = await this.prisma.order.findFirst({
      where: {
        id: payload.orderId,
        userId: userId,
      },
      include: {
        user: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'CREATED') {
      throw new BadRequestException('Order cannot be paid for in its current state.');
    }

    const amountKobo = Math.round(order.quotedPrice.toNumber() * 100);
    const email = order.user.email;
    const reference = `DLV_${order.orderNumber}_${Date.now()}`;

    // 2. Handle Saved Card Flow
    if (payload.method === PaymentMethod.SAVED_CARD) {
      if (!payload.savedCardId) {
        throw new BadRequestException('savedCardId is required when using SAVED_CARD method');
      }

      const savedCard = await this.prisma.savedCard.findFirst({
        where: { id: payload.savedCardId, userId },
      });

      if (!savedCard) throw new NotFoundException('Saved card not found.');

      if (savedCard.provider === PaymentProvider.PAYSTACK) {
        await this.paystackService.chargeAuthorization(email, amountKobo, savedCard.authorizationCode, reference);
      } else {
        await this.monnifyService.chargeAuthorization(email, amountKobo, savedCard.authorizationCode, reference);
      }

      return {
        message: 'Payment successful via saved card. Awaiting webhook confirmation.',
        reference,
      };
    }

    // 3. Handle New Card / Initialization Flow
    let result;
    if (payload.provider === PaymentProvider.PAYSTACK) {
      result = await this.paystackService.initializePayment(email, amountKobo, reference);
    } else {
      result = await this.monnifyService.initializePayment(email, amountKobo, reference);
    }

    // Save the pending payment to DB to track the reference
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        amount: order.quotedPrice,
        platformFee: 0,
        operatorAmount: order.quotedPrice,
        provider: payload.provider,
        providerReference: reference,
        status: 'PENDING',
      },
      create: {
        orderId: order.id,
        amount: order.quotedPrice,
        platformFee: 0,
        operatorAmount: order.quotedPrice,
        provider: payload.provider,
        providerReference: reference,
        status: 'PENDING',
      },
    });

    return result;
  }

  async getEarningsSummary(userId: string) {
    const { wallet } = await this.getOperatorWallet(userId);

    // Sum all CREDIT transactions to get "Total Amount Earned" historically
    const totalEarnedAggregate = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
      },
      _sum: {
        amount: true,
      },
    });

    return {
      balance: wallet.balance,
      escrowBalance: wallet.escrowBalance,
      totalEarned: totalEarnedAggregate._sum.amount ?? 0,
      currency: wallet.currency,
    };
  }

  async getTransactions(userId: string, page: number, limit: number) {
    const { wallet } = await this.getOperatorWallet(userId);
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async linkBankAccount(userId: string, payload: LinkBankAccountDto) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!operator) throw new NotFoundException('Operator profile not found.');

    // In a real app, verify the bank details against Paystack's Resolve Account API here.
    const isVerifiedMock = true; 

    const bankAccount = await this.prisma.bankAccount.upsert({
      where: { operatorId: operator.id },
      update: {
        bankCode: payload.bankCode,
        bankName: payload.bankName,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        isVerified: isVerifiedMock,
      },
      create: {
        operatorId: operator.id,
        bankCode: payload.bankCode,
        bankName: payload.bankName,
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
        isVerified: isVerifiedMock,
      },
    });

    return {
      message: 'Bank account linked successfully.',
      data: bankAccount,
    };
  }

  async getBankAccount(userId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!operator) throw new NotFoundException('Operator profile not found.');

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { operatorId: operator.id },
    });

    if (!bankAccount) {
      throw new NotFoundException('No linked bank account found.');
    }

    return { data: bankAccount };
  }

  async requestWithdrawal(userId: string, payload: WithdrawalDto) {
    const { operator, wallet } = await this.getOperatorWallet(userId);

    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { operatorId: operator.id },
    });

    if (!bankAccount || !bankAccount.isVerified) {
      throw new BadRequestException('You must link a verified bank account before withdrawing.');
    }

    if (wallet.balance.lessThan(payload.amount)) {
      throw new BadRequestException('Insufficient wallet balance for this withdrawal.');
    }

    // Process withdrawal in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct from wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: payload.amount },
        },
      });

      // 2. Create withdrawal SettlementRecord
      const settlement = await tx.settlementRecord.create({
        data: {
          operatorId: operator.id,
          amount: payload.amount,
          bankCode: bankAccount.bankCode,
          accountNumber: bankAccount.accountNumber,
          reference: `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          status: SettlementStatus.PENDING,
        },
      });

      // 3. Log the WalletTransaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: payload.amount,
          type: WalletTransactionType.SETTLEMENT,
          description: `Withdrawal to ${bankAccount.bankName} (${bankAccount.accountNumber.slice(-4)})`,
          reference: settlement.reference,
        },
      });

      return settlement;
    });

    // In a real app, queue a background job here to call Paystack/Monnify Transfers API
    // and update the SettlementRecord status to PROCESSING -> SUCCESS asynchronously via webhooks.

    return {
      message: 'Withdrawal requested successfully. Funds will arrive shortly.',
      data: result,
    };
  }
}
