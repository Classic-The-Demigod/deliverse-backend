import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
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
}
