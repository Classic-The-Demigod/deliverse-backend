import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CounterOfferStatus,
  OrderStatus,
  PaymentStatus,
  Role,
  UrgencyTier,
  WalletTransactionType,
  Prisma,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RespondCounterOfferDto } from './dto/respond-counter-offer.dto';


// ---------------------------------------------------------------------------
// Status transition rules — only these moves are valid from the business side
// ---------------------------------------------------------------------------
const BUSINESS_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.CREATED,
  OrderStatus.BROADCAST,
]);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable()
export class BusinessOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Get Quote
  // Mock Smart Quote Engine: Real-time pricing based on distance and vehicle.
  // -------------------------------------------------------------------------
  async getQuote(payload: { distanceKm: number; vehicleType: VehicleType; urgency: UrgencyTier }) {
    const operators = await this.prisma.operatorProfile.findMany({
      where: { 
        vehicles: {
          some: {
            vehicleType: payload.vehicleType,
            isActive: true
          }
        },
        pricingConfigs: {
          some: {
            vehicleType: payload.vehicleType,
            urgencyTier: payload.urgency,
            isActive: true
          }
        }
      },
      include: { 
        vehicles: true,
        pricingConfigs: true
      },
    });

    return operators.map((op) => {
      const rating = (op.trustScore / 20).toFixed(1);
      
      const uniqueTypes = Array.from(new Set(op.vehicles.map(v => v.vehicleType)));
      const deliveryMode = uniqueTypes.length > 0 
        ? uniqueTypes.map(t => t.charAt(0) + t.slice(1).toLowerCase()).join(' & ') 
        : 'Standard';

      const pricing = op.pricingConfigs.find(
        p => p.vehicleType === payload.vehicleType && p.urgencyTier === payload.urgency
      );

      // Should never happen due to the `where` clause, but fallback to prevent crash
      const baseFare = pricing ? Number(pricing.baseFare) : 0;
      const perKmRate = pricing ? Number(pricing.perKmRate) : 0;

      const distanceCost = payload.distanceKm * perKmRate;
      const price = Math.ceil(baseFare + distanceCost);

      let estimatedDelivery = '';
      if (payload.urgency === 'EXPRESS') estimatedDelivery = 'Same Day';
      else if (payload.urgency === 'STANDARD') estimatedDelivery = '2-3 hours';
      else estimatedDelivery = 'Scheduled';

      return {
        operatorId: op.id,
        companyName: op.companyName,
        rating: parseFloat(rating),
        deliveryMode,
        estimatedDelivery,
        price,
        expiresIn: 600,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Create order
  // Business creates an order. We:
  //   1. Resolve the business profile and confirm it is approved.
  //   2. Generate a unique order number.
  //   3. Compute dispatch deadline from urgency tier.
  //   4. Write Order + Payment (PENDING) + initial OrderStatusEvent atomically.
  //   5. Escrow the quoted price from the business wallet using Monnify/Paystack.
  //   6. Broadcast the order to operators.
  // -------------------------------------------------------------------------
  async create(userId: string, payload: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        wallet: { select: { id: true, balance: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is disabled.');
    }

    const quotedPrice = new Prisma.Decimal(payload.quotedPrice);
    
    const orderNumber = generateOrderNumber();
    const dispatchDeadline = resolveDispatchDeadline(payload.urgency);
    const estimatedDeliveryAt = payload.scheduledFor
      ? new Date(payload.scheduledFor)
      : resolveEstimatedDelivery(payload.urgency);

    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Create the order
      const created = await tx.order.create({
        data: {
          orderNumber,
          merchantReference: payload.merchantReference,
          status: OrderStatus.CREATED,
          userId: user.id,
          operatorId: payload.operatorId,
          pickupZoneId: payload.pickupZoneId,
          dropoffZoneId: payload.dropoffZoneId,
          vehicleType: payload.vehicleType,
          sensitivity: payload.sensitivity,
          urgency: payload.urgency,
          packageName: payload.packageName,
          weightKg: payload.weightKg,
          lengthCm: payload.lengthCm,
          widthCm: payload.widthCm,
          heightCm: payload.heightCm,
          description: payload.description,
          packageImageUrl: payload.packageImageUrl,
          declaredItemValue: payload.declaredItemValue
            ? new Prisma.Decimal(payload.declaredItemValue)
            : null,
          handlingNotes: payload.handlingNotes,
          specialInstructions: payload.specialInstructions,
          pickupPasscode: payload.pickupPasscode,
          dropoffPasscode: payload.dropoffPasscode,
          customOrderCategory: payload.customOrderCategory,
          orderReference: payload.orderReference,
          pickupAddress: payload.pickupAddress,
          pickupLatitude: payload.pickupLatitude,
          pickupLongitude: payload.pickupLongitude,
          pickupContactName: payload.pickupContactName,
          pickupContactPhone: payload.pickupContactPhone,
          dropoffAddress: payload.dropoffAddress,
          dropoffLatitude: payload.dropoffLatitude,
          dropoffLongitude: payload.dropoffLongitude,
          recipientName: payload.recipientName,
          recipientPhone: payload.recipientPhone,
          scheduledFor: payload.scheduledFor
            ? new Date(payload.scheduledFor)
            : null,
          distanceKm: payload.distanceKm,
          quotedPrice,
          dispatchDeadline,
          estimatedDeliveryAt,
          // OTP is generated at assignment time, not creation
        },
        select: orderDetailSelect,
      });

      // 2. Create payment record (PENDING until wallet escrow confirmed)
      await tx.payment.create({
        data: {
          orderId: created.id,
          amount: quotedPrice.mul(1 + PLATFORM_FEE_RATE),
          platformFee: quotedPrice.mul(PLATFORM_FEE_RATE),
          operatorAmount: quotedPrice,
          status: PaymentStatus.PENDING,
        },
      });

      // 5. Write the initial status event
      await tx.orderStatusEvent.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: OrderStatus.CREATED,
          actorId: userId,
          actorRole: Role.USER,
          notes: 'Order created by user.',
          occurredAt: new Date(),
        },
      });

      return created;
    });

    return {
      message: 'Order created successfully. Please proceed to payment.',
      order,
    };
  }

  // -------------------------------------------------------------------------
  // Broadcast Order (Mock WebSocket/Webhook Event Emitter)
  // -------------------------------------------------------------------------
  private broadcastOrderToOperators(orderId: string, operatorId?: string) {
    // In a full implementation, this would use a WebSocket Gateway or a Pub/Sub queue
    // to emit a 'NEW_ORDER_DEMAND' event to the specific Operator.
    console.log(`[BROADCAST] Alerting Operator ${operatorId} about new order ${orderId}`);
  }

  // -------------------------------------------------------------------------
  // List orders — paginated, scoped to the calling business
  // -------------------------------------------------------------------------
  async findAll(userId: string, query: ListOrdersDto) {
    const user = await this.resolveUserProfile(userId);

    const where: Prisma.OrderWhereInput = {
      userId: user.id,
      ...(query.status && { status: query.status }),
      ...(query.urgency && { urgency: query.urgency }),
      ...(query.vehicleType && { vehicleType: query.vehicleType }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from && { gte: new Date(query.from) }),
              ...(query.to && { lte: new Date(query.to) }),
            },
          }
        : {}),
      ...(query.search && {
        OR: [
          { orderNumber: { contains: query.search, mode: 'insensitive' } },
          {
            merchantReference: { contains: query.search, mode: 'insensitive' },
          },
          { recipientName: { contains: query.search, mode: 'insensitive' } },
          { recipientPhone: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: orderListSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Get one order — ownership enforced
  // -------------------------------------------------------------------------
  async findOne(userId: string, orderId: string) {
    const user = await this.resolveUserProfile(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this order.');
    }

    return { order };
  }

  // -------------------------------------------------------------------------
  // Cancel order
  // Only allowed from CREATED or BROADCAST. Once an operator has accepted,
  // cancellation goes through dispute/admin resolution instead.
  // -------------------------------------------------------------------------
  async cancel(
    userId: string,
    orderId: string,
    payload: CancelOrderDto,
  ) {
    const user = await this.resolveUserProfile(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        payment: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this order.');
    }

    if (!BUSINESS_CANCELLABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled from status "${order.status}". ` +
          `Cancellation is only allowed before an operator has accepted.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Transition order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // 2. Write status event
      await tx.orderStatusEvent.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          actorId: userId,
          actorRole: Role.USER,
          notes: payload.reason ?? 'Cancelled by user.',
          occurredAt: new Date(),
        },
      });

      // 3. Refund escrow back to wallet if payment was escrowed
      if (order.payment && order.payment.status === PaymentStatus.ESCROWED) {
        const wallet = await tx.wallet.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: order.payment.amount },
              escrowBalance: { decrement: order.payment.amount },
              transactions: {
                create: {
                  amount: order.payment.amount,
                  type: WalletTransactionType.REFUND,
                  description: `Escrow refund for cancelled order ${order.orderNumber}`,
                  reference: orderId,
                },
              },
            },
          });

          await tx.payment.update({
            where: { id: order.payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              refundedAt: new Date(),
            },
          });
        }
      }
    });

    return {
      message: 'Order cancelled and payment refunded.',
      orderId,
      status: OrderStatus.CANCELLED,
    };
  }

  // -------------------------------------------------------------------------
  // Respond to counter offer
  // Operator may counter the quoted price. Business can accept or reject.
  // Accepting updates finalPrice and re-evaluates escrow top-up if needed.
  // -------------------------------------------------------------------------
  async respondToCounterOffer(
    userId: string,
    orderId: string,
    payload: RespondCounterOfferDto,
  ) {
    const user = await this.resolveUserProfile(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        quotedPrice: true,
        counterOfferPrice: true,
        counterOfferStatus: true,
        operatorId: true,
        operator: { include: { user: true } },
        payment: { select: { id: true, status: true, amount: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this order.');
    }

    if (order.status !== OrderStatus.BROADCAST) {
      throw new BadRequestException(
        'Counter offer can only be responded to while the order is being broadcast.',
      );
    }

    if (
      !order.counterOfferPrice ||
      order.counterOfferStatus !== CounterOfferStatus.PENDING
    ) {
      throw new BadRequestException(
        'There is no pending counter offer on this order.',
      );
    }

    if (payload.accept) {
      // Accepting the counter offer
      const counterPrice = order.counterOfferPrice;
      const previousAmount = order.payment?.amount ?? order.quotedPrice;
      const delta = counterPrice.sub(previousAmount);

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            counterOfferStatus: CounterOfferStatus.ACCEPTED,
            finalPrice: counterPrice,
          },
        });

        await tx.orderStatusEvent.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status, // status doesn't change here, acceptance triggers operator assignment
            actorId: userId,
            actorRole: Role.USER,
            notes: `Counter offer of ${counterPrice} accepted by user.`,
            occurredAt: new Date(),
          },
        });

        // If counter price is higher, collect the difference from wallet
        if (delta.greaterThan(0)) {
          const wallet = await tx.wallet.findFirst({
            where: { userId: user.id },
            select: { id: true, balance: true },
          });

          if (!wallet) {
            throw new BadRequestException('User wallet not found.');
          }

          if (wallet.balance.lessThan(delta)) {
            throw new BadRequestException(
              'Insufficient wallet balance to cover the counter offer price.',
            );
          }

          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { decrement: delta },
              escrowBalance: { increment: delta },
              transactions: {
                create: {
                  amount: delta,
                  type: WalletTransactionType.ESCROW_HOLD,
                  description: `Additional escrow for counter offer on order ${order.orderNumber}`,
                  reference: orderId,
                },
              },
            },
          });
        }

        // Update payment amount to reflect final agreed price
        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: {
              amount: counterPrice.mul(1 + PLATFORM_FEE_RATE),
              operatorAmount: counterPrice,
              platformFee: counterPrice.mul(PLATFORM_FEE_RATE),
            },
          });
        }

        // Send notification to Operator if they have notifyDelivery enabled
        if (order.operator && order.operator.user.notifyDelivery) {
          await tx.notification.create({
            data: {
              userId: order.operator.userId,
              type: 'ORDER_ACCEPTED',
              title: 'Counter Offer Accepted',
              body: `The user has accepted your counter offer for order ${order.orderNumber}. Please proceed to assign a driver.`,
              data: { orderId },
            }
          });
        }
      });

      return {
        message:
          'Counter offer accepted. Operator will be notified to proceed.',
        orderId,
        finalPrice: order.counterOfferPrice,
        counterOfferStatus: CounterOfferStatus.ACCEPTED,
      };
    } else {
      // Rejecting — order goes back to broadcast, counter offer is cleared
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            counterOfferStatus: CounterOfferStatus.REJECTED,
            counterOfferPrice: null,
            counterOfferNote: null,
          },
        });

        await tx.orderStatusEvent.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            actorId: userId,
            actorRole: Role.USER,
            notes:
              `Counter offer rejected by user. ${payload.note ?? ''}`.trim(),
            occurredAt: new Date(),
          },
        });
      });

      return {
        message: 'Counter offer rejected.',
        orderId,
        counterOfferStatus: CounterOfferStatus.REJECTED,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  private async resolveUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled.');
    }

    return user;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLATFORM_FEE_RATE = 0.03; // 3% — move to config service later

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DLV-${timestamp}-${random}`;
}

function resolveDispatchDeadline(urgency: UrgencyTier): Date {
  const now = Date.now();
  const windows: Record<UrgencyTier, number> = {
    [UrgencyTier.EXPRESS]: 10 * 60 * 1000, // 10 minutes
    [UrgencyTier.STANDARD]: 30 * 60 * 1000, // 30 minutes
    [UrgencyTier.SCHEDULED]: 60 * 60 * 1000, // 1 hour (overridden by scheduledFor)
  };
  return new Date(now + windows[urgency]);
}

function resolveEstimatedDelivery(urgency: UrgencyTier): Date {
  const now = Date.now();
  const estimates: Record<UrgencyTier, number> = {
    [UrgencyTier.EXPRESS]: 2 * 60 * 60 * 1000, // 2 hours
    [UrgencyTier.STANDARD]: 6 * 60 * 60 * 1000, // 6 hours
    [UrgencyTier.SCHEDULED]: 24 * 60 * 60 * 1000, // 24 hours
  };
  return new Date(now + estimates[urgency]);
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------
const orderListSelect = {
  id: true,
  orderNumber: true,
  merchantReference: true,
  status: true,
  packageName: true,
  packageImageUrl: true,
  weightKg: true,
  trackingToken: true,
  urgency: true,
  vehicleType: true,
  sensitivity: true,
  pickupAddress: true,
  dropoffAddress: true,
  recipientName: true,
  recipientPhone: true,
  quotedPrice: true,
  finalPrice: true,
  counterOfferPrice: true,
  counterOfferStatus: true,
  distanceKm: true,
  scheduledFor: true,
  estimatedDeliveryAt: true,
  actualDeliveredAt: true,
  createdAt: true,
  pickupPasscode: true,
  dropoffPasscode: true,
  operator: {
    select: {
      id: true,
      companyName: true,
    },
  },
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      user: {
        select: {
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
  userId: true,
  description: true,
  packageImageUrl: true,
  packageName: true,
  weightKg: true,
  lengthCm: true,
  widthCm: true,
  heightCm: true,
  declaredItemValue: true,
  handlingNotes: true,
  specialInstructions: true,
  pickupLatitude: true,
  pickupLongitude: true,
  pickupContactName: true,
  pickupContactPhone: true,
  dropoffLatitude: true,
  dropoffLongitude: true,
  pickupPasscode: true,
  dropoffPasscode: true,
  pickupZoneId: true,
  dropoffZoneId: true,
  quotedPrice: true,
  counterOfferNote: true,
  dispatchDeadline: true,
  estimatedPickupAt: true,
  broadcastedAt: true,
  acceptedAt: true,
  assignedAt: true,
  arrivedPickupAt: true,
  actualPickedUpAt: true,
  arrivedDestinationAt: true,
  cancelledAt: true,
  failedAt: true,
  trackingToken: true,
  otpVerified: true,
  pickupGeoVerified: true,
  deliveryGeoVerified: true,
  updatedAt: true,
  payment: {
    select: {
      id: true,
      amount: true,
      platformFee: true,
      operatorAmount: true,
      status: true,
      paidAt: true,
      releasedAt: true,
    },
  },
  statusEvents: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      actorRole: true,
      notes: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'asc' },
  },
  dispute: {
    select: {
      id: true,
      type: true,
      status: true,
      description: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderSelect;
