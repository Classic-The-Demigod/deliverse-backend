import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async getPublicTracking(trackingToken: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { trackingToken },
          { orderNumber: trackingToken }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        packageName: true,
        packageImageUrl: true,
        weightKg: true,
        urgency: true,
        vehicleType: true,
        pickupAddress: true,
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffAddress: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
        pickupPasscode: true,
        dropoffPasscode: true,
        estimatedDeliveryAt: true,
        actualDeliveredAt: true,
        distanceKm: true,
        createdAt: true,
        statusEvents: {
          select: {
            id: true,
            toStatus: true,
            notes: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: 'asc' },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            currentLatitude: true,
            currentLongitude: true,
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Tracking link is invalid or expired.');
    }

    return order;
  }

  confirmReceipt(
    trackingToken: string,
    payload: Record<string, unknown>,
  ) {
    return {
      module: 'tracking',
      action: 'confirm-receipt',
      trackingToken,
      status: 'scaffolded',
      payload,
    };
  }

  async rateExperience(
    trackingToken: string,
    payload: { rating: number; reviewText?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { trackingToken },
          { id: trackingToken }
        ]
      }
    });

    if (!order) throw new NotFoundException('Order not found');

    if (!order.driverId) throw new NotFoundException('No driver assigned to this order');

    const rating = await this.prisma.rating.create({
      data: {
        orderId: order.id,
        driverId: order.driverId,
        score: payload.rating,
        comment: payload.reviewText || null,
        category: 'OVERALL',
      }
    });

    return rating;
  }
}
