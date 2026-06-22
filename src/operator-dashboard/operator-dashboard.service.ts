import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatSessionType, WalletTransactionType } from '@prisma/client';

@Injectable()
export class OperatorDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(userId: string, filter: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            escrowBalance: true,
            transactions: {
              where: { type: WalletTransactionType.CREDIT },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found');
    }

    const operatorId = operator.id;
    const operatorWallet = operator.wallet;

    // ─── Order-based stats (still try orders table first) ───────────────────
    const totalDeliveries = await this.prisma.order.count({
      where: { operatorId, status: 'DELIVERED' },
    });

    const activeOrders = await this.prisma.order.count({
      where: {
        operatorId,
        status: { in: ['ASSIGNED', 'IN_TRANSIT', 'PICKED_UP', 'ARRIVED_DESTINATION'] },
      },
    });

    const completedOrders = await this.prisma.order.findMany({
      where: { operatorId, status: 'DELIVERED', actualPickedUpAt: { not: null }, actualDeliveredAt: { not: null } },
      select: { actualPickedUpAt: true, actualDeliveredAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let avgDeliveryTimeMins = 0;
    if (completedOrders.length > 0) {
      const totalMinutes = completedOrders.reduce((sum, order) => {
        const diffMs = order.actualDeliveredAt!.getTime() - order.actualPickedUpAt!.getTime();
        return sum + diffMs / (1000 * 60);
      }, 0);
      avgDeliveryTimeMins = Math.round(totalMinutes / completedOrders.length);
    }

    // ─── Earnings: Use wallet balance as the source of truth ────────────────
    // Wallet balance = all CREDIT transactions (operator's cut of delivered orders)
    // This is reliable even if orders table is empty/cleared.
    const totalEarnings = operatorWallet?.balance?.toNumber() || 0;

    // Escrow held = operator wallet escrowBalance (funds reserved for active orders)
    const escrowHeld = operatorWallet?.escrowBalance?.toNumber() || 0;

    // Total deliveries from wallet CREDIT transactions (fallback if orders table empty)
    const walletCreditTxs = operatorWallet?.transactions || [];
    const effectiveTotalDeliveries = totalDeliveries > 0 ? totalDeliveries : walletCreditTxs.length;

    // ─── Recent Deliveries (from orders table; fall back to wallet txs) ──────
    const recentDeliveriesRaw = await this.prisma.order.findMany({
      where: { operatorId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { driver: true },
    });

    let recentDeliveries: any[];
    if (recentDeliveriesRaw.length > 0) {
      recentDeliveries = recentDeliveriesRaw.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        packageName: order.packageName,
        packageImageUrl: order.packageImageUrl,
        driverName: order.driver ? `${order.driver.firstName} ${order.driver.lastName.charAt(0)}.` : 'Unassigned',
        status: order.status,
        etaMins: order.status === 'DELIVERED'
          ? '-'
          : (order.estimatedDeliveryAt
            ? Math.max(0, Math.round((order.estimatedDeliveryAt.getTime() - Date.now()) / 60000)) + ' Mins'
            : '15 Mins'),
      }));
    } else {
      // Fallback: build recent deliveries from wallet CREDIT transactions
      recentDeliveries = walletCreditTxs.slice(0, 4).map((tx) => {
        // Extract order reference from description, e.g. "Earnings for order <id>"
        const orderRef = tx.reference || tx.description.split('order ')[1] || 'N/A';
        return {
          id: tx.id,
          orderNumber: orderRef.substring(0, 12).toUpperCase(),
          packageName: 'Delivered Package',
          packageImageUrl: null,
          driverName: 'Driver',
          status: 'DELIVERED',
          etaMins: '-',
          earnings: tx.amount.toNumber(),
        };
      });
    }

    // ─── Sales Data: Built from wallet CREDIT transactions ───────────────────
    const today = new Date();
    let salesStartDate = new Date();

    if (filter === 'week') {
      salesStartDate.setDate(today.getDate() - 14); // 2 weeks for prev comparison
    } else if (filter === 'year') {
      salesStartDate.setFullYear(today.getFullYear() - 2); // 2 years for prev comparison
    } else {
      salesStartDate.setDate(today.getDate() - 60); // 2 months for prev comparison
    }

    // Fetch all CREDIT transactions for this operator's wallet in the relevant period
    const creditTxs = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: operatorWallet?.id,
        type: WalletTransactionType.CREDIT,
        createdAt: { gte: salesStartDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    let salesData: any[] = [];

    if (filter === 'week') {
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const halfPoint = new Date(today);
      halfPoint.setDate(today.getDate() - 7);

      const thisWeekTxs = creditTxs.filter(t => t.createdAt >= halfPoint);
      const prevWeekTxs = creditTxs.filter(t => t.createdAt < halfPoint);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayStr = d.toDateString();

        const prevD = new Date(d);
        prevD.setDate(prevD.getDate() - 7);
        const prevStr = prevD.toDateString();

        const thisRev = thisWeekTxs.filter(t => t.createdAt.toDateString() === dayStr).reduce((s, t) => s + t.amount.toNumber(), 0);
        const prevRev = prevWeekTxs.filter(t => t.createdAt.toDateString() === prevStr).reduce((s, t) => s + t.amount.toNumber(), 0);

        salesData.push({ name: daysOfWeek[d.getDay()], thisMonth: thisRev, prevMonth: prevRev });
      }
    } else if (filter === 'year') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const thisYearStart = new Date(today.getFullYear(), 0, 1);
      const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);

      const thisYearTxs = creditTxs.filter(t => t.createdAt >= thisYearStart);
      const prevYearTxs = creditTxs.filter(t => t.createdAt >= prevYearStart && t.createdAt < thisYearStart);

      for (let i = 11; i >= 0; i--) {
        const d = new Date(today);
        d.setMonth(today.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();

        const thisRev = thisYearTxs.filter(t => t.createdAt.getMonth() === month && t.createdAt.getFullYear() === year).reduce((s, t) => s + t.amount.toNumber(), 0);

        const prevYear = year - 1;
        const prevRev = prevYearTxs.filter(t => t.createdAt.getMonth() === month && t.createdAt.getFullYear() === prevYear).reduce((s, t) => s + t.amount.toNumber(), 0);

        salesData.push({ name: months[d.getMonth()], thisMonth: thisRev, prevMonth: prevRev });
      }
    } else {
      // Monthly: 4 weeks (W1–W4), compare against previous month
      const monthStart = new Date(today);
      monthStart.setDate(today.getDate() - 30);
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setDate(monthStart.getDate() - 30);

      const thisMonthTxs = creditTxs.filter(t => t.createdAt >= monthStart);
      const prevMonthTxs = creditTxs.filter(t => t.createdAt >= prevMonthStart && t.createdAt < monthStart);

      for (let i = 3; i >= 0; i--) {
        const end = new Date(today);
        end.setDate(today.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(end.getDate() - 7);

        const prevEnd = new Date(end);
        prevEnd.setDate(prevEnd.getDate() - 30);
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - 30);

        const thisRev = thisMonthTxs.filter(t => t.createdAt >= start && t.createdAt < end).reduce((s, t) => s + t.amount.toNumber(), 0);
        const prevRev = prevMonthTxs.filter(t => t.createdAt >= prevStart && t.createdAt < prevEnd).reduce((s, t) => s + t.amount.toNumber(), 0);

        salesData.push({ name: `W${4 - i}`, thisMonth: thisRev, prevMonth: prevRev });
      }
    }

    // ─── Incoming Request ────────────────────────────────────────────────────
    const incomingRequestRaw = await this.prisma.order.findFirst({
      where: { operatorId, status: { in: ['CREATED', 'ASSIGNED', 'IN_TRANSIT'] } },
      orderBy: { createdAt: 'desc' },
    });

    let incomingRequest: any = null;
    if (incomingRequestRaw) {
      incomingRequest = {
        orderNumber: incomingRequestRaw.orderNumber,
        price: incomingRequestRaw.finalPrice?.toNumber() || incomingRequestRaw.quotedPrice?.toNumber() || 0,
        packageImageUrl: incomingRequestRaw.packageImageUrl,
        pickupAddress: incomingRequestRaw.pickupAddress,
        dropoffAddress: incomingRequestRaw.dropoffAddress,
        urgency: incomingRequestRaw.urgency,
      };
    }

    // ─── Messages ────────────────────────────────────────────────────────────
    const activeSessions = await this.prisma.chatSession.findMany({
      where: {
        type: { not: ChatSessionType.ORDER },
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                email: true,
                operatorProfile: { select: { companyName: true } },
                driverProfile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });

    const messages = activeSessions
      .filter(s => s.messages.length > 0)
      .map(s => {
        const m = s.messages[0];
        const otherParticipant = s.participants.find(p => p.userId !== userId) || s.participants[0];
        const otherUser = otherParticipant.user;
        const senderName =
          otherUser.operatorProfile?.companyName ||
          (otherUser.driverProfile
            ? `${otherUser.driverProfile.firstName || ''} ${otherUser.driverProfile.lastName || ''}`.trim()
            : '') ||
          otherUser.fullName ||
          otherUser.email.split('@')[0];

        const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        return {
          id: m.id,
          sender: senderName,
          avatarUrl: otherUser.avatarUrl,
          text: m.content === 'Voice Note' ? '🎤 Voice note' : m.content,
          time: timeFormatter.format(m.createdAt),
          unread: !m.isRead && m.senderId !== userId,
          driverUserId: otherUser.id,
        };
      });

    // ─── Setup Status ────────────────────────────────────────────────────────
    const hasVehicles = (await this.prisma.vehicle.count({ where: { operatorId } })) > 0;
    const hasDrivers = (await this.prisma.driverProfile.count({ where: { operatorId, vehicleId: { not: null } } })) > 0;
    const hasPricing = (await this.prisma.pricingConfig.count({ where: { operatorId, isActive: true } })) > 0;

    return {
      totalDeliveries: effectiveTotalDeliveries,
      totalEarnings,
      activeOrders,
      avgDeliveryTime: avgDeliveryTimeMins,
      escrowHeld,
      salesData,
      recentDeliveries,
      messages,
      incomingRequest,
      setupStatus: {
        hasVehicles,
        hasDrivers,
        hasPricing,
      },
    };
  }
}
