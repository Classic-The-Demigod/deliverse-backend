import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '@prisma/client';

import { MailService } from '../mail/mail.service';

export interface TransitionContext {
  actorId: string;
  actorRole: Role;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  notes?: string;
  payload?: any;
}

@Injectable()
export class DeliveryStateMachineService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  getAllowedTransitions(): Record<OrderStatus, OrderStatus[]> {
    return {
      CREATED: ['SCHEDULED', 'ACCEPTED', 'CANCELLED'],
      SCHEDULED: ['ACCEPTED', 'CANCELLED'],
      BROADCAST: ['ACCEPTED', 'ASSIGNED', 'CANCELLED'],
      ACCEPTED: ['ASSIGNED', 'BROADCAST', 'CANCELLED'],
      ASSIGNED: ['ARRIVED_PICKUP', 'FAILED', 'CANCELLED', 'ACCEPTED'],
      ARRIVED_PICKUP: ['PICKED_UP', 'FAILED', 'CANCELLED'],
      PICKED_UP: ['IN_TRANSIT'],
      IN_TRANSIT: ['ARRIVED_DESTINATION', 'FAILED'],
      ARRIVED_DESTINATION: ['DELIVERED', 'RETURNED', 'FAILED'],
      DELIVERED: [],
      CANCELLED: [],
      FAILED: [],
      RETURNED: [],
    };
  }

  canTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    const allowed = this.getAllowedTransitions()[currentStatus];
    return allowed ? allowed.includes(nextStatus) : false;
  }

  async transitionOrderState(
    orderId: string,
    nextStatus: OrderStatus,
    context: TransitionContext,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current order state and user
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, orderNumber: true, user: { select: { email: true, fullName: true, notifyDelivery: true } } },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      const currentStatus = order.status;

      // 2. Validate transition
      if (!this.canTransition(currentStatus, nextStatus)) {
        throw new BadRequestException(
          `Invalid state transition from ${currentStatus} to ${nextStatus}`,
        );
      }

      // 3. Update order
      const updateData: any = {
        status: nextStatus,
      };

      // Add timestamps depending on the state
      const now = new Date();
      switch (nextStatus) {
        case OrderStatus.BROADCAST:
          updateData.broadcastedAt = now;
          break;
        case OrderStatus.ACCEPTED:
          updateData.acceptedAt = now;
          break;
        case OrderStatus.ASSIGNED:
          updateData.assignedAt = now;
          break;
        case OrderStatus.ARRIVED_PICKUP:
          updateData.arrivedPickupAt = now;
          break;
        case OrderStatus.PICKED_UP:
          updateData.actualPickedUpAt = now;
          break;
        case OrderStatus.ARRIVED_DESTINATION:
          updateData.arrivedDestinationAt = now;
          break;
        case OrderStatus.DELIVERED:
          updateData.actualDeliveredAt = now;
          break;
        case OrderStatus.CANCELLED:
          updateData.cancelledAt = now;
          break;
        case OrderStatus.FAILED:
          updateData.failedAt = now;
          break;
        case OrderStatus.RETURNED:
          updateData.returnedAt = now;
          break;
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // 4. Log Event (Immutable Audit Trail)
      await tx.orderStatusEvent.create({
        data: {
          orderId,
          fromStatus: currentStatus,
          toStatus: nextStatus,
          actorId: context.actorId,
          actorRole: context.actorRole,
          latitude: context.latitude,
          longitude: context.longitude,
          deviceId: context.deviceId,
          notes: context.notes,
          payload: context.payload ? JSON.stringify(context.payload) : undefined,
          occurredAt: now,
        },
      });

      return { updatedOrder, orderDetails: order };
    });

    // 5. Send Email if user has notifications enabled
    if (result.orderDetails.user && result.orderDetails.user.notifyDelivery !== false) {
      // Send for meaningful status updates
      const notifyStatuses = ['ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED'];
      if (notifyStatuses.includes(nextStatus)) {
        await this.mailService.sendOrderStatusEmail(
          result.orderDetails.user.email,
          result.orderDetails.user.fullName || 'Customer',
          result.orderDetails.orderNumber,
          nextStatus
        );
      }
    }

    return result.updatedOrder;
  }
}
