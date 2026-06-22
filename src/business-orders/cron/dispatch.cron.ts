import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DispatchCron {
  private readonly logger = new Logger(DispatchCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledDispatches() {
    this.logger.log('Checking for scheduled orders to dispatch...');

    // Find orders that are SCHEDULED and within 1 hour of their scheduled time
    const threshold = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const scheduledOrders = await this.prisma.order.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: threshold, // Less than or equal to 1 hour from now
        },
      },
    });

    if (scheduledOrders.length === 0) return;

    this.logger.log(`Found ${scheduledOrders.length} scheduled order(s) ready for dispatch.`);

    for (const order of scheduledOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Update status to ACCEPTED
          await tx.order.update({
            where: { id: order.id },
            data: { 
              status: 'ACCEPTED', 
              acceptedAt: new Date() 
            },
          });

          // Create status event log
          await tx.orderStatusEvent.create({
            data: {
              orderId: order.id,
              toStatus: 'ACCEPTED',
              fromStatus: 'SCHEDULED',
              actorRole: 'ADMIN',
              actorId: 'SYSTEM',
              notes: 'Automatically accepted scheduled order.',
              occurredAt: new Date(),
            },
          });
        });
        this.logger.log(`Successfully broadcasted scheduled order ${order.orderNumber}`);
      } catch (error) {
        this.logger.error(`Failed to broadcast scheduled order ${order.orderNumber}`, error);
      }
    }
  }
}
