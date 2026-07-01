import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriverAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { operator: true }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const driverId = driver.id;

    // Get all orders completed by this driver
    const completedOrders = await this.prisma.order.findMany({
      where: {
        driverId,
        status: 'DELIVERED',
      },
      select: {
        id: true,
        actualDeliveredAt: true,
        distanceKm: true,
        finalPrice: true,
      }
    });

    const totalDistance = completedOrders.reduce((sum, order) => sum + (order.distanceKm || 0), 0);
    const totalDeliveries = completedOrders.length;
    
    // Group earnings by last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(dateStr => {
      const dayOrders = completedOrders.filter(o => 
        o.actualDeliveredAt && o.actualDeliveredAt.toISOString().startsWith(dateStr)
      );
      
      // Calculate display earnings based on the Operator's configured visual percentage
      const percentageMultiplier = (driver.operator?.driverEarningsDisplayPercentage || 0) / 100;
      const orderEarnings = dayOrders.reduce((sum, order) => sum + (Number(order.finalPrice || 0) * percentageMultiplier), 0);

      return { date: dateStr, amount: orderEarnings, count: dayOrders.length };
    });

    // We can also check wallet transactions, but for test reliability, we use the order data directly.
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      const recentTransactions = await this.prisma.walletTransaction.findMany({
        where: {
          walletId: wallet.id,
          type: 'CREDIT',
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7))
          }
        }
      });

      // If we have actual wallet transactions, override the estimated order earnings
      if (recentTransactions.length > 0) {
        chartData.forEach(day => day.amount = 0); // reset
        recentTransactions.forEach(tx => {
          const txDate = tx.createdAt.toISOString().split('T')[0];
          const dayMatch = chartData.find(d => d.date === txDate);
          if (dayMatch) {
            dayMatch.amount += Number(tx.amount);
          }
        });
      }
    }

    // Ratings
    const ratings = await this.prisma.rating.findMany({
      where: { driverId }
    });
    const avgRating = ratings.length > 0 
      ? ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length 
      : 0;

    return {
      totalDistance,
      totalDeliveries,
      avgRating,
      chartData,
    };
  }
}
