import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStatus, ChatSessionType } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationsOverview() {
    const [
      totalBusinesses,
      activeDrivers,
      totalDeliveries,
      revenueResult,
      recentApprovals,
    ] = await Promise.all([
      this.prisma.businessProfile.count({ where: { isApproved: true } }),
      this.prisma.driverProfile.count({ where: { onboardingStatus: OnboardingStatus.APPROVED } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.payment.aggregate({ _sum: { platformFee: true } }),
      this.prisma.businessProfile.findMany({
        orderBy: { reviewedAt: 'desc' },
        take: 5,
        include: { user: true },
        where: { onboardingStatus: { in: [OnboardingStatus.APPROVED, OnboardingStatus.PENDING_REVIEW] } }
      }),
    ]);

    const revenue = revenueResult._sum.platformFee ? Number(revenueResult._sum.platformFee) : 0;

    const formattedRecentApprovals = recentApprovals.map(b => ({
      id: b.id,
      name: b.businessName,
      type: 'Business',
      status: b.onboardingStatus === OnboardingStatus.APPROVED ? 'Approved' : 'Pending',
      time: b.reviewedAt ? b.reviewedAt.toISOString() : (b.onboardingSubmittedAt?.toISOString() || b.user.createdAt.toISOString())
    }));

    return {
      totalBusinesses,
      activeDrivers,
      totalDeliveries,
      revenue,
      recentApprovals: formattedRecentApprovals,
    };
  }

  async listOpenDisputes() {
    // Fetch all open disputes or recently resolved ones
    const disputes = await this.prisma.dispute.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { orderNumber: true }
        },
        resolvedBy: {
          select: { fullName: true }
        }
      }
    });

    // Also fetch ChatSessions of type SUPPORT
    // so we can display them as "Chats" in the UI
    const supportChats = await this.prisma.chatSession.findMany({
      where: { type: ChatSessionType.SUPPORT },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                businessProfile: { select: { businessName: true } },
                operatorProfile: { select: { companyName: true } },
                driverProfile: { select: { firstName: true, lastName: true } },
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return { disputes, supportChats };
  }

  async resolveDispute(id: string, resolution: string, adminId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const adminProfile = await this.prisma.adminProfile.findUnique({ where: { userId: adminId } });
    if (!adminProfile) throw new BadRequestException('Admin profile not found');

    return this.prisma.dispute.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedById: adminProfile.id,
        resolvedAt: new Date(),
      }
    });
  }

  suspendOperator(operatorId: string, payload: Record<string, unknown>) {
    return {
      module: 'admin',
      action: 'suspend-operator',
      operatorId,
      status: 'scaffolded',
      payload,
    };
  }

  suspendDriver(driverId: string, payload: Record<string, unknown>) {
    return {
      module: 'admin',
      action: 'suspend-driver',
      driverId,
      status: 'scaffolded',
      payload,
    };
  }

  getOperatorLeaderboard() {
    return {
      module: 'admin',
      action: 'operator-leaderboard',
      status: 'scaffolded',
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        adminProfile: true,
        driverProfile: true,
        businessProfile: true,
        operatorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserDetails(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        adminProfile: true,
        driverProfile: {
          include: { documents: true }
        },
        businessProfile: {
          include: { documents: true }
        },
        operatorProfile: {
          include: { documents: true }
        },
      }
    });

    if (!user) throw new NotFoundException('User not found');

    // Fetch related orders based on role
    let orders: any[] = [];
    if (user.role === 'DRIVER' && user.driverProfile) {
      orders = await this.prisma.order.findMany({
        where: { driverId: user.driverProfile.id },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to recent 50
        include: { pickupZone: true, dropoffZone: true, payment: true }
      });
    } else if (user.role === 'OPERATOR' && user.operatorProfile) {
      orders = await this.prisma.order.findMany({
        where: { operatorId: user.operatorProfile.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { pickupZone: true, dropoffZone: true, payment: true }
      });
    } else {
      // User or Business
      orders = await this.prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { pickupZone: true, dropoffZone: true, payment: true }
      });
    }

    return { ...user, recentOrders: orders };
  }

  async getPendingBusinesses() {
    return this.prisma.businessProfile.findMany({
      where: {
        onboardingStatus: { in: [OnboardingStatus.PENDING_REVIEW, OnboardingStatus.DRAFT] },
      },
      include: {
        user: true,
        documents: true,
      },
      orderBy: { onboardingSubmittedAt: 'asc' },
    });
  }

  async approveBusiness(id: string) {
    const business = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.businessProfile.update({
      where: { id },
      data: {
        isApproved: true,
        onboardingStatus: OnboardingStatus.APPROVED,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: { user: true },
    });
  }

  async rejectBusiness(id: string, reason: string) {
    const business = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.businessProfile.update({
      where: { id },
      data: {
        isApproved: false,
        onboardingStatus: OnboardingStatus.REJECTED,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: { user: true },
    });
  }

  async getPendingDrivers() {
    return this.prisma.driverProfile.findMany({
      where: {
        onboardingStatus: { in: [OnboardingStatus.PENDING_REVIEW, OnboardingStatus.DRAFT] },
      },
      include: {
        user: true,
        operator: true,
        documents: true,
      },
      orderBy: { onboardingSubmittedAt: 'asc' },
    });
  }

  async approveDriver(id: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        onboardingStatus: OnboardingStatus.APPROVED,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: { user: true },
    });
  }

  async rejectDriver(id: string, reason: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Driver not found');

    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        onboardingStatus: OnboardingStatus.REJECTED,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: { user: true },
    });
  }

  // --- Orders ---

  async getAllOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true } },
        driver: { select: { firstName: true, lastName: true, user: { select: { email: true, phone: true } } } },
        operator: { select: { companyName: true } },
        pickupZone: true,
        dropoffZone: true,
      }
    });
  }

  async getOrderDetails(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
        driver: { select: { id: true, firstName: true, lastName: true, photoUrl: true, user: { select: { email: true, phone: true } } } },
        operator: { select: { id: true, companyName: true, logoUrl: true } },
        pickupZone: true,
        dropoffZone: true,
        payment: { select: { status: true, amount: true, platformFee: true, providerChannel: true, createdAt: true } }, // Do not include gateway full response
      }
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // --- Settings & Profile ---

  async getAdminProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        notifyDelivery: true,
        notifyPayment: true,
        notifyDispatch: true,
        notifyAnnouncements: true,
      },
    });
  }

  async updateAdminProfile(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        phone: data.phone,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });
  }

  async requestSecurityOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await argon2.hash(code);
    
    await this.prisma.verificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    
    console.log(`\n\n=== ADMIN SECURITY OTP ===`);
    console.log(`Verification Code for ${user.email}: ${code}`);
    console.log(`===========================\n\n`);

    return { message: 'OTP sent to your email.' };
  }

  async verifySecurityOtp(userId: string, data: any) {
    const { otp, newPassword } = data;
    
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) throw new BadRequestException('Invalid verification code.');

    const isValid = await argon2.verify(verificationCode.code, otp);
    if (!isValid) throw new BadRequestException('Invalid verification code.');

    if (verificationCode.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code expired.');
    }

    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { isUsed: true },
    });

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password updated successfully.' };
  }

  async updateNotifications(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyDelivery: data.notifyDelivery ?? undefined,
        notifyPayment: data.notifyPayment ?? undefined,
        notifyDispatch: data.notifyDispatch ?? undefined,
        notifyAnnouncements: data.notifyAnnouncements ?? undefined,
      },
      select: {
        id: true,
        notifyDelivery: true,
        notifyPayment: true,
        notifyDispatch: true,
        notifyAnnouncements: true,
      },
    });
  }

  async getSystemSettings() {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({
        data: {},
      });
    }
    return settings;
  }

  async updateSystemSettings(data: any) {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }
    
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: {
        commissionRate: data.commissionRate !== undefined ? data.commissionRate : undefined,
        maxDeliveryRadius: data.maxDeliveryRadius !== undefined ? data.maxDeliveryRadius : undefined,
        maintenanceMode: data.maintenanceMode !== undefined ? data.maintenanceMode : undefined,
      },
    });
  }

  // --- Announcements ---

  async getAnnouncements() {
    return this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnnouncement(data: any) {
    return this.prisma.announcement.create({
      data: {
        title: data.title,
        body: data.body,
        targetRoles: data.targetRoles || ['USER', 'DRIVER', 'OPERATOR'],
      },
    });
  }

  async deleteAnnouncement(id: string) {
    return this.prisma.announcement.delete({
      where: { id },
    });
  }
}
