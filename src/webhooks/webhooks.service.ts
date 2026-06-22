import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  createEndpoint(payload: Record<string, unknown>) {
    return {
      module: 'webhooks',
      action: 'create-endpoint',
      status: 'scaffolded',
      payload,
    };
  }

  listEndpoints() {
    return {
      module: 'webhooks',
      action: 'list-endpoints',
      status: 'scaffolded',
    };
  }

  listDeliveries(endpointId: string) {
    return {
      module: 'webhooks',
      action: 'list-deliveries',
      endpointId,
      status: 'scaffolded',
    };
  }

  async handlePaystackWebhook(signature: string, payload: any) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || 'sk_test_placeholder';
    const hash = crypto.createHmac('sha512', secretKey).update(JSON.stringify(payload)).digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    const event = payload.event;
    if (event === 'charge.success') {
      await this.processSuccessfulPayment(payload.data.reference, payload.data.amount, PaymentProvider.PAYSTACK, payload.data.authorization, payload.data.customer?.email);
    }

    return { status: 'success' };
  }

  async handleMonnifyWebhook(signature: string, payload: any) {
    const secretKey = this.configService.get<string>('MONNIFY_SECRET_KEY') || 'SK_TEST_PLACEHOLDER';
    const hash = crypto.createHmac('sha512', secretKey).update(JSON.stringify(payload)).digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid signature');
    }

    const eventType = payload.eventType;
    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      await this.processSuccessfulPayment(payload.eventData.paymentReference, payload.eventData.amountPaid * 100, PaymentProvider.MONNIFY, payload.eventData.cardDetails, payload.eventData.customer?.email);
    }

    return { status: 'success' };
  }

  private async processSuccessfulPayment(reference: string, amountKobo: number, provider: PaymentProvider, authorization: any, email?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: reference },
      include: { 
        order: { 
          include: { 
            user: true,
            operator: {
              include: { user: true }
            }
          } 
        } 
      },
    });

    if (!payment) return;
    if (payment.status === 'ESCROWED' || payment.status === 'RELEASED') return; // Idempotency

    // Optionally verify amount here (allow small tolerance if needed)
    // if (Math.round(payment.amount.toNumber() * 100) !== amountKobo) {
    //   throw new BadRequestException('Amount mismatch');
    // }

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark Payment as ESCROWED
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'ESCROWED', paidAt: new Date(), providerResponse: authorization },
      });

      // 1.5 Update wallet escrow balance so driver can collect it
      const userWallet = await tx.wallet.findUnique({
        where: { userId: payment.order.user.id }
      });
      if (userWallet) {
        await tx.wallet.update({
          where: { id: userWallet.id },
          data: {
            escrowBalance: { increment: payment.amount },
            transactions: {
              create: {
                amount: payment.amount,
                type: 'ESCROW_HOLD',
                description: `Escrow hold via Gateway for order ${payment.order.orderNumber}`,
                reference: payment.order.id,
              }
            }
          }
        });
      }

      // 2. Mark Order as ACCEPTED or SCHEDULED
      const nextStatus = payment.order.urgency === 'SCHEDULED' ? 'SCHEDULED' : 'ACCEPTED';
      const acceptedData = nextStatus === 'ACCEPTED' ? { acceptedAt: new Date() } : {};

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: nextStatus, ...acceptedData },
      });

      // 3. Save Card if reusable
      if (authorization && authorization.reusable && authorization.authorization_code) {
        const userId = payment.order.user.id;
        
        // Find if it already exists
        const existing = await tx.savedCard.findFirst({
          where: { userId, authorizationCode: authorization.authorization_code }
        });

        if (!existing) {
          await tx.savedCard.create({
            data: {
              userId,
              provider,
              authorizationCode: authorization.authorization_code,
              cardType: authorization.card_type || 'Unknown',
              last4: authorization.last4 || '0000',
              expMonth: authorization.exp_month || '12',
              expYear: authorization.exp_year || '2099',
            }
          });
        }
      }

      // 4. Send notification to Operator if they have notifyPayment enabled
      if (payment.order.operator && payment.order.operator.user.notifyPayment) {
        await tx.notification.create({
          data: {
            userId: payment.order.operator.userId,
            type: 'PAYMENT_RELEASED', // We can use this or create a new type. Schema has PAYMENT_RELEASED which can act as payment notification
            title: 'Payment Escrowed',
            body: `User has successfully paid for Order ${payment.order.orderNumber}. The funds are securely in escrow.`,
            data: { orderId: payment.order.id, amount: payment.amount.toString() },
          }
        });
      }
    });
  }
}
