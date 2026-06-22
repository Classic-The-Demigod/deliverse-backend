import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class OperatorFleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getFleet(userId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!operator) throw new NotFoundException('Operator not found');

    const vehicles = await this.prisma.vehicle.findMany({
      where: { operatorId: operator.id },
      orderBy: { createdAt: 'desc' },
      include: { 
        drivers: { select: { firstName: true, lastName: true } },
        documents: true
      }
    });

    const driversRaw = await this.prisma.driverProfile.findMany({
      where: { operatorId: operator.id },
      include: {
        vehicle: true,
        user: true,
        documents: true,
        ratings: {
          select: { score: true }
        },
        orders: {
          where: { status: 'DELIVERED' },
          select: { finalPrice: true }
        }
      },
    });

    const drivers = driversRaw.map(d => {
      const avgRating = d.ratings.length > 0 
        ? d.ratings.reduce((sum, r) => sum + r.score, 0) / d.ratings.length 
        : 0;

      return {
        id: d.id,
        userId: d.userId,
        name: `${d.firstName} ${d.lastName}`.trim() || 'New Driver',
        status: d.user?.isVerified ? d.status : 'PENDING',
        vehicle: d.vehicle ? `${d.vehicle.vehicleType} #${d.vehicle.licensePlate.substring(0,4)}` : 'Unassigned',
        deliveries: d.totalDeliveries,
        revenue: d.orders.reduce((sum, o) => sum + (o.finalPrice?.toNumber() || 0), 0),
        rating: avgRating > 0 ? avgRating.toFixed(1) : 'New',
        firstName: d.firstName,
        lastName: d.lastName,
        vehicleId: d.vehicleId,
        vehicleType: d.vehicle?.vehicleType || null,
        phone: d.user?.phone,
        dateOfBirth: d.user?.dateOfBirth,
        address: d.address,
        licenseNumber: d.licenseNumber,
        documents: d.documents,
      };
    });

    const pendingInvites = await this.prisma.userInvitation.findMany({
      where: { operatorId: operator.id, status: 'PENDING', role: 'DRIVER' },
      include: { assignedVehicle: true }
    });

    const inviteDrivers = pendingInvites.map(i => ({
      id: i.id,
      name: i.email || i.phone || 'Invited Driver',
      status: 'PENDING',
      vehicle: i.assignedVehicle ? `${i.assignedVehicle.vehicleType} #${i.assignedVehicle.licensePlate.substring(0,4)}` : 'Unassigned',
      deliveries: 0,
      revenue: 0,
      rating: 0,
      firstName: '',
      lastName: '',
      vehicleId: i.assignedVehicleId,
      vehicleType: i.assignedVehicle?.vehicleType || null,
    }));

    return { vehicles, drivers: [...drivers, ...inviteDrivers] };
  }

  async addVehicle(userId: string, dto: any) {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!operator) throw new NotFoundException('Operator not found');

    const documentsToCreate: any[] = [];
    if (dto.vinFileUrl) {
      documentsToCreate.push({
        type: 'VEHICLE_REGISTRATION',
        fileUrl: dto.vinFileUrl,
        operatorId: operator.id,
      });
    }

    return this.prisma.vehicle.create({
      data: {
        operatorId: operator.id,
        licensePlate: dto.licensePlate,
        vehicleType: dto.vehicleType,
        documents: documentsToCreate.length > 0 ? { create: documentsToCreate } : undefined
      }
    });
  }

  async inviteDriver(userId: string, dto: any) {
    const operator = await this.prisma.operatorProfile.findUnique({ 
      where: { userId }, 
      select: { id: true, companyName: true, user: { select: { fullName: true } } } 
    });
    if (!operator) throw new NotFoundException('Operator not found');

    const operatorName = operator.companyName || operator.user?.fullName || 'A Deliverse Operator';
    const inviteToken = crypto.randomBytes(32).toString('hex');
    
    // Create the placeholder user with their actual name so it's not "New Driver"
    let user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone || `temp_${Date.now()}`,
          role: 'DRIVER',
          isVerified: false,
          fullName: dto.fullName || 'New Driver',
          dateOfBirth: dto.dateOfBirth,
        }
      });
    }

    let driverProfile = await this.prisma.driverProfile.findUnique({ where: { userId: user.id } });
    if (!driverProfile) {
      const documentsToCreate: any[] = [];
      if (dto.ninFileUrl) documentsToCreate.push({ type: 'NIN', fileUrl: dto.ninFileUrl });
      if (dto.licenseFileUrl) documentsToCreate.push({ type: 'DRIVER_LICENSE', fileUrl: dto.licenseFileUrl });

      driverProfile = await this.prisma.driverProfile.create({
        data: {
          userId: user.id,
          operatorId: operator.id,
          firstName: dto.fullName?.split(' ')[0] || 'Driver',
          lastName: dto.fullName?.split(' ')[1] || '',
          address: dto.address,
          licenseNumber: dto.licenseNumber,
          vehicleId: dto.vehicleId || null,
          documents: {
            create: documentsToCreate
          }
        }
      });
    } else {
      // Update existing driver profile with new details and documents
      const documentsToCreate: any[] = [];
      if (dto.ninFileUrl) {
        await this.prisma.kycDocument.deleteMany({ where: { driverId: driverProfile.id, type: 'NIN' } });
        documentsToCreate.push({ type: 'NIN', fileUrl: dto.ninFileUrl });
      }
      if (dto.licenseFileUrl) {
        await this.prisma.kycDocument.deleteMany({ where: { driverId: driverProfile.id, type: 'DRIVER_LICENSE' } });
        documentsToCreate.push({ type: 'DRIVER_LICENSE', fileUrl: dto.licenseFileUrl });
      }

      driverProfile = await this.prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          operatorId: operator.id,
          firstName: dto.fullName?.split(' ')[0] || driverProfile.firstName,
          lastName: dto.fullName?.split(' ')[1] || driverProfile.lastName,
          address: dto.address || driverProfile.address,
          licenseNumber: dto.licenseNumber || driverProfile.licenseNumber,
          vehicleId: dto.vehicleId || driverProfile.vehicleId,
          documents: documentsToCreate.length > 0 ? { create: documentsToCreate } : undefined
        }
      });
    }

    const invitation = await this.prisma.userInvitation.create({
      data: {
        role: 'DRIVER',
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        operatorId: operator.id,
        inviteToken,
        assignedVehicleId: dto.vehicleId || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    await this.mailService.sendDriverInvitationEmail(
      dto.email.toLowerCase(),
      operatorName,
      inviteToken
    );

    return invitation;
  }

  async updateVehicle(userId: string, vehicleId: string, dto: any) {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!operator) throw new NotFoundException('Operator not found');
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId, operatorId: operator.id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (dto.vinFileUrl) {
      await this.prisma.kycDocument.deleteMany({ where: { vehicleId: vehicleId, type: 'VEHICLE_REGISTRATION' } });
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: { documents: { create: { type: 'VEHICLE_REGISTRATION', fileUrl: dto.vinFileUrl, operatorId: operator.id } } }
      });
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        licensePlate: dto.licensePlate,
        vehicleType: dto.vehicleType,
      }
    });
  }

  async deleteVehicle(userId: string, vehicleId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!operator) throw new NotFoundException('Operator not found');

    return this.prisma.vehicle.deleteMany({
      where: { id: vehicleId, operatorId: operator.id },
    });
  }

  async updateDriver(userId: string, driverId: string, dto: any) {
    const operator = await this.prisma.operatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!operator) throw new NotFoundException('Operator not found');

    const driverProfile = await this.prisma.driverProfile.findUnique({ where: { id: driverId, operatorId: operator.id } });
    if (!driverProfile) throw new NotFoundException('Driver not found');

    await this.prisma.user.update({
      where: { id: driverProfile.userId },
      data: {
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth,
      }
    });

    if (dto.ninFileUrl || dto.licenseFileUrl) {
      const documentsToCreate: any[] = [];
      if (dto.ninFileUrl) documentsToCreate.push({ type: 'NIN', fileUrl: dto.ninFileUrl, operatorId: operator.id });
      if (dto.licenseFileUrl) documentsToCreate.push({ type: 'DRIVER_LICENSE', fileUrl: dto.licenseFileUrl, operatorId: operator.id });
      
      // Delete existing documents of the same type if new ones are provided
      if (dto.ninFileUrl) await this.prisma.kycDocument.deleteMany({ where: { driverId: driverId, type: 'NIN' } });
      if (dto.licenseFileUrl) await this.prisma.kycDocument.deleteMany({ where: { driverId: driverId, type: 'DRIVER_LICENSE' } });

      await this.prisma.driverProfile.update({
        where: { id: driverId },
        data: { documents: { create: documentsToCreate } }
      });
    }

    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        vehicleId: dto.vehicleId || null,
        status: dto.status,
        address: dto.address,
        licenseNumber: dto.licenseNumber,
      }
    });
  }
}
