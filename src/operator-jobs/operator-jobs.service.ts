import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CounterOfferStatus, OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStateMachineService } from '../delivery-core/delivery-state-machine.service';
import { MailService } from '../mail/mail.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CounterOfferDto } from './dto/counter-offer.dto';
import { RejectJobDto } from './dto/reject-job.dto';

@Injectable()
export class OperatorJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: DeliveryStateMachineService,
    private readonly mailService: MailService,
  ) {}

  private async getOperator(userId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: { id: true, isApproved: true, isSuspended: true },
    });
    if (!operator) throw new NotFoundException('Operator profile not found.');
    if (operator.isSuspended)
      throw new ForbiddenException('Account is suspended.');
    return operator;
  }

  async findIncomingJobs(userId: string) {
    const operator = await this.getOperator(userId);

    const orders = await this.prisma.order.findMany({
      where: {
        operatorId: operator.id,
        OR: [
          { status: OrderStatus.CREATED },
          { status: OrderStatus.BROADCAST, acceptedAt: null }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        quotedPrice: true,
        distanceKm: true,
        pickupAddress: true,
        dropoffAddress: true,
        scheduledFor: true,
        packageImageUrl: true,
        vehicleType: true,
        status: true,
        packageName: true,
        weightKg: true,
        description: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: orders };
  }

  async accept(userId: string, orderId: string) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, counterOfferStatus: true, userId: true },
    });

    if (!order) throw new NotFoundException('Order not found.');

    if (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.BROADCAST) {
      throw new BadRequestException('Order is no longer available to accept.');
    }

    if (order.counterOfferStatus && order.counterOfferStatus !== CounterOfferStatus.ACCEPTED) {
        throw new BadRequestException('Order has a pending or rejected counter offer.');
    }

    // Assign operator to order
    await this.prisma.order.update({
      where: { id: orderId },
      data: { operatorId: operator.id },
    });

    // Transition State to ACCEPTED
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ACCEPTED, {
      actorId: userId,
      actorRole: Role.OPERATOR,
      notes: 'Order accepted by operator.',
    });

    // Notify Business
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_ACCEPTED',
        title: 'Order Accepted',
        body: `Your order #${orderId.substring(0,8)} was accepted by the operator.`,
      }
    });

    return { message: 'Order accepted. Please assign a driver within 20 minutes.', orderId };
  }

  async reject(userId: string, orderId: string, payload: RejectJobDto) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, operatorId: operator.id },
      select: { id: true, status: true, userId: true },
    });

    if (!order || (order.status !== OrderStatus.CREATED && order.status !== OrderStatus.BROADCAST)) {
      throw new BadRequestException('Cannot reject this order.');
    }

    await this.stateMachine.transitionOrderState(orderId, OrderStatus.CANCELLED, {
      actorId: userId,
      actorRole: Role.OPERATOR,
      notes: payload.reason || 'Operator declined order.',
    });

    // Notify Business
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER_CREATED', // fallback type since CANCELLED isn't in enum but we can use generic
        title: 'Order Declined',
        body: `Your order #${orderId.substring(0,8)} was declined by the operator. Please select another.`,
      }
    });

    return { message: 'Order rejected.', orderId };
  }

  async counterOffer(userId: string, orderId: string, payload: CounterOfferDto) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, orderNumber: true, user: { select: { email: true, fullName: true } } },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== OrderStatus.BROADCAST) {
      throw new BadRequestException('Order is no longer available for counter offers.');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        counterOfferStatus: CounterOfferStatus.PENDING,
        counterOfferPrice: payload.price,
        counterOfferNote: payload.note,
        operatorId: operator.id,
      },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorId: userId,
        actorRole: Role.OPERATOR,
        notes: `Counter offer submitted for ${payload.price}`,
        occurredAt: new Date(),
      },
    });

    if (order.user) {
      // Fetch operator business profile for name
      const operatorProfile = await this.prisma.operatorProfile.findUnique({
        where: { id: operator.id },
        select: { companyName: true, user: { select: { fullName: true } } }
      });
      const operatorName = operatorProfile?.companyName || operatorProfile?.user?.fullName || 'A Deliverse Operator';
      
      await this.mailService.sendCounterOfferEmail(
        order.user.email,
        order.user.fullName || 'User',
        order.orderNumber,
        payload.price,
        operatorName,
        payload.note
      );
    }

    return { message: 'Counter offer submitted to the business user.', orderId };
  }

  async getActiveDeliveries(userId: string) {
    const operator = await this.getOperator(userId);

    const orders = await this.prisma.order.findMany({
      where: {
        operatorId: operator.id,
        status: {
          in: [
            OrderStatus.ACCEPTED,
            OrderStatus.BROADCAST,
            OrderStatus.ASSIGNED,
            OrderStatus.ARRIVED_PICKUP,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.ARRIVED_DESTINATION
          ]
        }
      },
      select: {
        id: true,
        orderNumber: true,
        quotedPrice: true,
        distanceKm: true,
        pickupAddress: true,
        dropoffAddress: true,
        scheduledFor: true,
        packageImageUrl: true,
        vehicleType: true,
        status: true,
        estimatedDeliveryAt: true,
        packageName: true,
        weightKg: true,
        description: true,
        driverAccepted: true,
        driver: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            user: { select: { phone: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { data: orders };
  }

  async assignDriver(userId: string, orderId: string, payload: AssignDriverDto) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, operatorId: true, acceptedAt: true, vehicleType: true, userId: true, orderNumber: true, pickupAddress: true, dropoffAddress: true },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.operatorId !== operator.id) throw new ForbiddenException('Not your order.');
    if (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.BROADCAST) {
      throw new BadRequestException('Order must be ACCEPTED or BROADCAST first.');
    }

    const targetDriver = await this.prisma.driverProfile.findUnique({
      where: { id: payload.driverId },
      select: { 
        userId: true,
        firstName: true,
        vehicle: { select: { vehicleType: true } },
        user: { select: { email: true } },
      },
    });

    if (!targetDriver) throw new NotFoundException('Driver not found.');
    if (targetDriver.vehicle?.vehicleType !== order.vehicleType) {
      throw new BadRequestException(`Order requires a ${order.vehicleType}, but driver has a ${targetDriver.vehicle?.vehicleType || 'none'}.`);
    }

    // 20-minute SLA dispatch check would occur here, or via a cron job
    // If Date.now() - order.acceptedAt.getTime() > 20 mins, flag dispatch delay.

    // Assign driver record
    await this.prisma.driverAssignment.create({
      data: {
        orderId,
        operatorId: operator.id,
        driverId: payload.driverId,
        notes: payload.notes,
      },
    });

    // Update Order driver ID
    await this.prisma.order.update({
      where: { id: orderId },
      data: { 
        driverId: payload.driverId,
        driverAccepted: false,
      },
    });

    // State Transition
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.ASSIGNED, {
      actorId: userId,
      actorRole: Role.OPERATOR,
      notes: `Order assigned to driver ${targetDriver.firstName}`,
    });

    // Notify Business & Driver
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        type: 'DRIVER_ASSIGNED',
        title: 'Driver Assigned',
        body: `A driver has been assigned to your order #${orderId.substring(0,8)}.`,
      }
    });

    await this.prisma.notification.create({
      data: {
        userId: targetDriver.userId,
        type: 'DRIVER_ASSIGNED',
        title: 'New Delivery Assigned',
        body: `You have been assigned to order #${orderId.substring(0,8)}. Please check your active deliveries.`,
      }
    });

    if (targetDriver.user?.email && order.orderNumber && order.pickupAddress && order.dropoffAddress) {
      await this.mailService.sendDriverAssignedEmail(
        targetDriver.user.email,
        targetDriver.firstName,
        order.orderNumber,
        order.pickupAddress,
        order.dropoffAddress
      );
    }

    return { message: 'Driver assigned successfully.', orderId };
  }

  async getOrderDetails(userId: string, orderId: string) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId, operatorId: operator.id },
      include: {
        driver: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            currentLatitude: true,
            currentLongitude: true,
            status: true,
            user: { select: { phone: true } },
          }
        },
        statusEvents: {
          orderBy: { occurredAt: 'asc' },
          select: { toStatus: true, occurredAt: true }
        }
      }
    });

    if (!order) throw new NotFoundException('Order not found or not yours.');

    return { data: order };
  }

  async reassignDriver(userId: string, orderId: string, payload: AssignDriverDto) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, operatorId: true, vehicleType: true },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.operatorId !== operator.id) throw new ForbiddenException('Not your order.');

    const targetDriver = await this.prisma.driverProfile.findUnique({
      where: { id: payload.driverId },
      select: { vehicle: { select: { vehicleType: true } } },
    });

    if (!targetDriver) throw new NotFoundException('Driver not found.');
    if (targetDriver.vehicle?.vehicleType !== order.vehicleType) {
      throw new BadRequestException(`Order requires a ${order.vehicleType}, but driver has a ${targetDriver.vehicle?.vehicleType || 'none'}.`);
    }

    // Mark previous assignment complete/reassigned
    await this.prisma.driverAssignment.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status: 'REASSIGNED', releasedAt: new Date() },
    });

    // Create new
    await this.prisma.driverAssignment.create({
      data: {
        orderId,
        operatorId: operator.id,
        driverId: payload.driverId,
        notes: payload.notes,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { 
        driverId: payload.driverId,
        driverAccepted: false,
      },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorId: userId,
        actorRole: Role.OPERATOR,
        notes: `Driver reassigned to ${payload.driverId}`,
        occurredAt: new Date(),
      },
    });

    return { message: 'Driver reassigned successfully.', orderId };
  }

  async broadcast(userId: string, orderId: string) {
    const operator = await this.getOperator(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, operatorId: true },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.operatorId !== operator.id) throw new ForbiddenException('Not your order.');
    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException('Order must be ACCEPTED first.');
    }

    // Transition State to BROADCAST
    await this.stateMachine.transitionOrderState(orderId, OrderStatus.BROADCAST, {
      actorId: userId,
      actorRole: Role.OPERATOR,
      notes: 'Order broadcasted to fleet by operator.',
    });

    return { message: 'Order broadcasted to drivers successfully.', orderId };
  }
}
