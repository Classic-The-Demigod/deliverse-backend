import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getOverview() {
    return {
      name: 'Deliverse Backend',
      status: 'ok',
      version: 'v1-foundation',
      modules: [
        'auth',
        'business-orders',
        'operator-jobs',
        'driver-tasks',
        'tracking',
        'payments',
        'disputes',
        'admin',
        'webhooks',
      ],
    };
  }

  async getBusinesses(category?: string) {
    const where: any = { isApproved: true };
    if (category) {
      const catStr = category.toUpperCase();
      
      // Map frontend service IDs to Prisma BusinessCategory Enum
      if (catStr === 'RESTAURANT') where.category = 'RESTAURANT';
      else if (catStr === 'PHARMACY') where.category = 'PHARMACY';
      else if (catStr === 'GROCERIES') where.category = 'GROCERIES';
      else if (catStr === 'FASHION') where.category = 'FASHION';
      else if (catStr === 'ELECTRONICS') where.category = 'ELECTRONICS';
      else if (catStr === 'HEALTH_BEAUTY') where.category = 'HEALTH_BEAUTY';
      else if (catStr === 'RETAIL' || catStr === 'MARKET') where.category = 'RETAIL';
      else where.category = 'OTHER';
    }

    const businesses = await this.prisma.businessProfile.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        category: true,
        logoUrl: true,
        website: true,
      }
    });

    return businesses.map(b => ({
      id: b.id,
      name: b.businessName,
      website: b.website,
      logo: b.logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100',
      description: 'Official Business Partner',
      rating: 4.5
    }));
  }
}
