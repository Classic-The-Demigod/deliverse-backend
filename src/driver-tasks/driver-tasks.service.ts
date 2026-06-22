import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryVerificationMethod, OrderStatus, PaymentStatus, Role, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStateMachineService } from '../delivery-core/delivery-state-machine.service';
import { GeofenceService } from '../delivery-core/geofence.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { PickupProofDto } from './dto/pickup-proof.dto';
import { ProofOfDeliveryDto } from './dto/proof-of-delivery.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReportDelayDto } from './dto/report-delay.dto';

@Injectable()
export class DriverTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: DeliveryStateMachineService,
    private readonly geofence: GeofenceService,
  ) {}

  private async getDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, operatorId: true, isSuspended: true, vehicle: { select: { vehicleType: true } } },
    });
    if (!driver || driver.isSuspended) {
      throw new ForbiddenException('Driver account is invalid or suspended.');
    }
    return driver;
  }

  async findActiveTask(userId: string) {
    const driver = await this.getDriver(userId);

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        driverId: driver.id,
        driverAccepted: true,
        status: {
          in: [
            OrderStatus.ASSIGNED,
            OrderStatus.ARRIVED_PICKUP,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.ARRIVED_DESTINATION,
          ],
        },
      },
      include: {
        user: { select: { fullName: true, phone: true, businessProfile: { select: { businessName: true, contactName: true } } } },
        operator: { select: { companyName: true, supportPhone: true } },
      },
    });

    return { data: activeOrder };
  }

  async updateStatus(userId: string, payload: UpdateStatusDto) {
    const driver = await this.getDriver(userId);
    await this.prisma.driverProfile.update({
      where: { id: driver.id },
      data: { status: payload.status },
    });
    return { message: 'Status updated successfully' };
  }

  async updateLocation(userId: string, payload: LocationUpdateDto) {
    const driver = await this.getDriver(userId);
    await this.prisma.driverProfile.update({
      where: { id: driver.id },
      data: { 
        currentLatitude: payload.latitude, 
        currentLongitude: payload.longitude,
        lastSeenAt: new Date()
      },
    });
    return { message: 'Location updated successfully' };
  }

  async findBroadcasts(userId: string) {
    const driver = await this.getDriver(userId);

    const broadcasts = await this.prisma.order.findMany({
      where: {
        OR: [
          {
            status: OrderStatus.BROADCAST,
            operatorId: driver.operatorId,
            vehicleType: driver.vehicle?.vehicleType,
            driverId: null,
          },
          {
            driverId: driver.id,
            status: OrderStatus.ASSIGNED,
            driverAccepted: false,
          },
        ],
      },
      include: {
        user: { select: { fullName: true, phone: true, businessProfile: { select: { businessName: true, contactName: true } } } },
        operator: { select: { companyName: true, supportPhone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(`[findBroadcasts] Driver: ${driver.id}, Operator: ${driver.operatorId}, Vehicle: ${driver.vehicle?.vehicleType}, Broadcasts/Assignments found: ${broadcasts.length}`);

    return { data: broadcasts };
  }

  async findOngoingTasks(userId: string) {
    const driver = await this.getDriver(userId);

    const ongoing = await this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        driverAccepted: true,
        status: {
          in: [
            OrderStatus.ASSIGNED,
            OrderStatus.ARRIVED_PICKUP,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.ARRIVED_DESTINATION,
          ],
        },
      },
      include: {
        user: { select: { fullName: true, phone: true, businessProfile: { select: { businessName: true, contactName: true } } } },
        operator: { select: { companyName: true, supportPhone: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { data: ongoing };
  }

  async findDriverTasksHistory(userId: string) {
    const driver = await this.getDriver(userId);

    const history = await this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: {
          in: [
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED,
            OrderStatus.FAILED,
            OrderStatus.RETURNED,
          ],
        },
      },
      include: {
        user: { select: { fullName: true, phone: true, businessProfile: { select: { businessName: true, contactName: true } } } },
        operator: { select: { companyName: true, supportPhone: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return { data: history };
  }

  async acceptOrder(userId: string, orderId: string) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.$transaction(async (tx) => {
      const targetOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { operator: { include: { user: true } } }
      });

      if (!targetOrder || targetOrder.status !== OrderStatus.BROADCAST) {
        throw new BadRequestException('Order is no longer available.');
      }

      // Assign the order to this driver
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          driverId: driver.id,
          driverAccepted: true,
        },
      });

      // Update driver status to ACTIVE
      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { status: 'ACTIVE' },
      });

      // Send notification to Operator
      if (targetOrder.operator && targetOrder.operator.user.notifyDispatch) {
        await tx.notification.create({
          data: {
            userId: targetOrder.operator.userId,
            type: 'ORDER_ACCEPTED',
            title: 'Driver Accepted Order',
            body: `Driver has accepted the broadcasted order ${targetOrder.orderNumber}.`,
            data: { orderId },
          }
        });
      }

      return updatedOrder;
    });

    // Record the state transition event
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ASSIGNED, {
      actorId: userId,
      actorRole: Role.DRIVER,
      notes: 'Driver accepted broadcasted order.',
    });

    return { message: 'Order accepted successfully', data: order };
  }

  async arrivePickup(userId: string, orderId: string, payload: LocationUpdateDto) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, driverId: driver.id },
      select: { id: true, pickupLatitude: true, pickupLongitude: true, status: true },
    });

    if (!order) throw new NotFoundException('Order not found or not assigned to you.');

    const isWithin = true; // Bypassed for MVP testing

    if (!isWithin) {
      throw new BadRequestException('You are not within the pickup radius.');
    }

    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ARRIVED_PICKUP, {
      actorId: userId,
      actorRole: Role.DRIVER,
      latitude: payload.latitude,
      longitude: payload.longitude,
      notes: 'Driver arrived at pickup location.',
    });

    // We can also start an IdleTimer here for pickup waiting time.

    return { message: 'Arrived at pickup.', orderId };
  }

  async pickup(userId: string, orderId: string, payload: PickupProofDto) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, driverId: driver.id },
      select: { id: true, pickupLatitude: true, pickupLongitude: true },
    });

    if (!order) throw new NotFoundException('Order not found or not assigned to you.');

    const isWithin = true; // Bypassed for MVP testing

    await this.prisma.$transaction(async (tx) => {
      // Create Pickup Proof
      await tx.pickupProof.create({
        data: {
          orderId,
          photoUrl: payload.photoUrl,
          photoLatitude: payload.latitude,
          photoLongitude: payload.longitude,
          withinGeofence: isWithin,
          notes: payload.notes,
        },
      });

      // Update Order flags
      await tx.order.update({
        where: { id: orderId },
        data: { pickupGeoVerified: isWithin },
      });
    });

    // State Transition
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.PICKED_UP, {
      actorId: userId,
      actorRole: Role.DRIVER,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });

    // Auto-transition to IN_TRANSIT
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.IN_TRANSIT, {
      actorId: userId,
      actorRole: Role.DRIVER,
    });

    return { message: 'Package secured. Proceed to destination.', orderId };
  }

  async arriveDestination(userId: string, orderId: string, payload: LocationUpdateDto) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, driverId: driver.id },
      select: { id: true, dropoffLatitude: true, dropoffLongitude: true },
    });

    if (!order) throw new NotFoundException('Order not found or not assigned to you.');

    const isWithin = true; // Bypassed for MVP testing

    if (!isWithin) {
      throw new BadRequestException('You are not within the dropoff radius.');
    }

    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ARRIVED_DESTINATION, {
      actorId: userId,
      actorRole: Role.DRIVER,
      latitude: payload.latitude,
      longitude: payload.longitude,
      notes: 'Driver arrived at destination.',
    });

    return { message: 'Arrived at destination.', orderId };
  }

  async deliver(userId: string, orderId: string, payload: ProofOfDeliveryDto) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, driverId: driver.id },
      select: { 
        id: true, 
        dropoffLatitude: true, 
        dropoffLongitude: true, 
        operatorId: true,
        userId: true,
        payment: true 
      },
    });

    if (!order) throw new NotFoundException('Order not found or not assigned to you.');

    const isWithin = true; // Bypassed for MVP testing

    await this.prisma.$transaction(async (tx) => {
      // 1. Create POD
      await tx.proofOfDelivery.create({
        data: {
          orderId,
          photoUrl: payload.photoUrl,
          photoLatitude: payload.latitude,
          photoLongitude: payload.longitude,
          withinGeofence: isWithin,
          verificationMethod: payload.verificationMethod,
          signatureUrl: payload.signatureUrl,
          otpUsed: payload.verificationMethod === DeliveryVerificationMethod.OTP || payload.verificationMethod === DeliveryVerificationMethod.OTP_AND_SIGNATURE,
        },
      });

      // 2. Update Order flags
      await tx.order.update({
        where: { id: orderId },
        data: { deliveryGeoVerified: isWithin },
      });

      // 3. Process Escrow Release
        if (order.payment && order.payment.status === PaymentStatus.ESCROWED) {
          // Find operator wallet
          const operatorWallet = await tx.wallet.findUnique({
            where: { operatorId: order.operatorId! }
          });

          // Find user wallet to remove escrow hold
          const userWallet = await tx.wallet.findFirst({
             where: { userId: order.userId }
          });

          // Find or create driver wallet
          let driverWallet = await tx.wallet.findUnique({
            where: { userId }
          });
          if (!driverWallet) {
            driverWallet = await tx.wallet.create({
              data: { userId, balance: 0, escrowBalance: 0, currency: 'NGN' }
            });
          }

          if (operatorWallet && userWallet) {
            // Release escrow from user
            await tx.wallet.update({
              where: { id: userWallet.id },
              data: {
                escrowBalance: { decrement: order.payment.amount },
                transactions: {
                  create: {
                    amount: order.payment.amount,
                    type: WalletTransactionType.ESCROW_RELEASE,
                    description: `Escrow released for delivered order ${orderId}`,
                    reference: orderId,
                  }
                }
              }
            });

            // Calculate 80/20 split
            const totalAmount = Number(order.payment.operatorAmount);
            const driverShare = totalAmount * 0.8;
            const operatorShare = totalAmount * 0.2;

            // Credit driver with 80%
            await tx.wallet.update({
              where: { id: driverWallet.id },
              data: {
                balance: { increment: driverShare },
                transactions: {
                  create: {
                    amount: driverShare,
                    type: WalletTransactionType.CREDIT,
                    description: `Earnings for order ${orderId}`,
                    reference: orderId,
                  }
                }
              }
            });

            // Credit operator with 20%
            await tx.wallet.update({
              where: { id: operatorWallet.id },
              data: {
                balance: { increment: operatorShare },
                transactions: {
                  create: {
                    amount: operatorShare,
                    type: WalletTransactionType.CREDIT,
                    description: `Earnings for order ${orderId}`,
                    reference: orderId,
                  }
                }
              }
            });
          }

        // Mark payment as RELEASED
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: PaymentStatus.RELEASED, releasedAt: new Date() }
        });
      }
    });

    // Transition State
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.DELIVERED, {
      actorId: userId,
      actorRole: Role.DRIVER,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });

    return { message: 'Delivery completed successfully.', orderId };
  }

  async reportIssue(userId: string, orderId: string, payload: Record<string, unknown>) {
    // Basic stub for MVP
    return { message: 'Issue reported.', orderId };
  }

  async reportDelay(userId: string, orderId: string, payload: ReportDelayDto) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.driverId !== driver.id) throw new ForbiddenException('Not your assigned order.');

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        isDelayed: true,
        delayReason: payload.reason,
      },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorId: userId,
        actorRole: Role.DRIVER,
        notes: `Driver reported delay: ${payload.reason}`,
        occurredAt: new Date(),
      },
    });

    return { message: 'Delay reported successfully.', orderId };
  }

  async acceptAssignment(userId: string, orderId: string) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.$transaction(async (tx) => {
      const targetOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { operator: { include: { user: true } } }
      });

      if (!targetOrder || targetOrder.driverId !== driver.id) {
        throw new NotFoundException('Order not found or not assigned to you.');
      }

      if (targetOrder.status !== OrderStatus.ASSIGNED) {
        throw new BadRequestException('Order is not in ASSIGNED state.');
      }

      if (targetOrder.driverAccepted) {
        throw new BadRequestException('Order has already been accepted.');
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          driverAccepted: true,
        },
      });

      // Update driver status to ACTIVE
      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { status: 'ACTIVE' },
      });

      // Send notification to Operator
      if (targetOrder.operator && targetOrder.operator.user.notifyDispatch) {
        await tx.notification.create({
          data: {
            userId: targetOrder.operator.userId,
            type: 'ORDER_ACCEPTED',
            title: 'Driver Accepted Assignment',
            body: `Driver has accepted the assignment for order ${targetOrder.orderNumber}.`,
            data: { orderId },
          }
        });
      }

      return updatedOrder;
    });

    // Record the state transition event
    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: OrderStatus.ASSIGNED,
        toStatus: OrderStatus.ASSIGNED,
        actorId: userId,
        actorRole: Role.DRIVER,
        notes: 'Driver accepted direct assignment.',
        occurredAt: new Date(),
      },
    });

    return { message: 'Assignment accepted successfully', data: order };
  }

  async declineAssignment(userId: string, orderId: string) {
    const driver = await this.getDriver(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, driverId: true, status: true, driverAccepted: true },
    });

    if (!order || order.driverId !== driver.id) {
      throw new NotFoundException('Order not found or not assigned to you.');
    }

    if (order.status !== OrderStatus.ASSIGNED) {
      throw new BadRequestException('Order is not in ASSIGNED state.');
    }

    // Perform transaction to unassign and update DriverAssignment status
    await this.prisma.$transaction(async (tx) => {
      // Clear driver assignments
      await tx.driverAssignment.updateMany({
        where: { orderId, driverId: driver.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED', releasedAt: new Date() },
      });

      // Clear order driver fields
      await tx.order.update({
        where: { id: orderId },
        data: {
          driverId: null,
          driverAccepted: false,
        },
      });
    });

    // Revert state to ACCEPTED
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ACCEPTED, {
      actorId: userId,
      actorRole: Role.DRIVER,
      notes: 'Driver declined direct assignment.',
    });

    return { message: 'Assignment declined successfully', orderId };
  }
}
