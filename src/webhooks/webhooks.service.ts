import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider, WebhookDeliveryStatus, WebhookEventType } from '@prisma/client';
import * as crypto from 'crypto';
import axios from 'axios';
import { globalEventEmitter } from '../common/events/global-event-emitter';
import { CloudTasksClient } from '@google-cloud/tasks';

import { MailService } from '../mail/mail.service';

@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger(WebhooksService.name);
  private cloudTasksClient?: CloudTasksClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    if (projectId) {
      this.cloudTasksClient = new CloudTasksClient();
    }
  }

  onModuleInit() {
    globalEventEmitter.on('order.status.updated', async (eventData) => {
      this.logger.log(`Intercepted order status update for ${eventData.orderId} to ${eventData.newStatus}, dispatching webhook...`);
      await this.dispatchOrderWebhook(eventData.orderId, 'ORDER_STATUS_CHANGED', eventData.payload);
    });
  }

  async dispatchOrderWebhook(orderId: string, event: WebhookEventType, payload: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          include: { businessProfile: true }
        }
      }
    });

    if (!order || !order.user.businessProfile) return;

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { 
        businessId: order.user.businessProfile.id,
        isActive: true,
      }
    });

    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    const location = this.configService.get<string>('GCP_LOCATION') || 'us-central1';
    const queue = this.configService.get<string>('GCP_WEBHOOK_QUEUE') || 'webhooks';
    const baseUrl = this.configService.get<string>('API_BASE_URL') || 'http://localhost:3000';

    for (const endpoint of endpoints) {
      if (this.cloudTasksClient && projectId) {
        // Enqueue to Cloud Tasks
        const queuePath = this.cloudTasksClient.queuePath(projectId, location, queue);
        const task = {
          httpRequest: {
            httpMethod: 'POST' as const,
            url: `${baseUrl}/webhooks/internal-dispatch`,
            headers: {
              'Content-Type': 'application/json',
              'x-deliverse-endpoint-id': endpoint.id,
              'x-deliverse-event': event,
              'x-deliverse-order-id': orderId,
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          },
        };
        await this.cloudTasksClient.createTask({ parent: queuePath, task });
        this.logger.log(`Enqueued webhook task for endpoint ${endpoint.id}`);
      } else {
        // Fallback to direct synchronous execution
        await this.executeWebhookDelivery(endpoint.id, event, payload, order.user.email);
      }
    }
  }

  async executeWebhookDelivery(endpointId: string, event: WebhookEventType, payload: any, userEmail?: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) return;

    if (!userEmail) {
      const biz = await this.prisma.businessProfile.findUnique({
        where: { id: endpoint.businessId },
        include: { user: true }
      });
      userEmail = biz?.user?.email || undefined;
    }

    const delivery = await this.prisma.webhookDeliveryAttempt.create({
      data: {
        endpointId: endpoint.id,
        event,
        status: WebhookDeliveryStatus.PENDING,
        payload: payload,
      }
    });

    try {
      const signature = crypto.createHmac('sha512', endpoint.secret).update(JSON.stringify(payload)).digest('hex');
      const response = await axios.post(endpoint.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Deliverse-Signature': signature,
          'X-Deliverse-Event': event,
        },
        timeout: 10000,
      });

      await this.prisma.webhookDeliveryAttempt.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.SUCCESS,
          responseStatusCode: response.status,
          responseBody: JSON.stringify(response.data),
        }
      });
    } catch (error: any) {
      await this.prisma.webhookDeliveryAttempt.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.FAILED,
          responseStatusCode: error.response?.status || 500,
          responseBody: error.response?.data ? JSON.stringify(error.response.data) : error.message,
        }
      });
      
      const recentAttempts = await this.prisma.webhookDeliveryAttempt.findMany({
        where: { endpointId: endpoint.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      const allFailed = recentAttempts.length >= 3 && recentAttempts.every(a => a.status === WebhookDeliveryStatus.FAILED);
      if (allFailed && userEmail) {
        await this.mailService.sendWebhookFailureEmail(userEmail, endpoint.url);
      }

      // Throw so Cloud Tasks knows it failed and will retry
      throw new Error(`Webhook delivery failed: ${error.message}`);
    }
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

      await tx.orderStatusEvent.create({
        data: {
          orderId: payment.orderId,
          fromStatus: payment.order.status,
          toStatus: nextStatus,
          actorId: payment.order.userId,
          actorRole: 'USER',
          notes: `Payment verified. Order status updated to ${nextStatus}.`,
          occurredAt: new Date(),
        },
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

    // 5. Send Order Receipt Email
    await this.mailService.sendOrderReceiptEmail(
      payment.order.user.email,
      payment.order.user.fullName || 'Customer',
      payment.order.orderNumber,
      payment.amount.toNumber()
    );
  }
}
