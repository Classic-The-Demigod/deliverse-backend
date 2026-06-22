import { Injectable } from '@nestjs/common';

@Injectable()
export class DisputesService {
  create(payload: Record<string, unknown>) {
    return {
      module: 'disputes',
      action: 'create',
      status: 'scaffolded',
      payload,
    };
  }

  findOne(disputeId: string) {
    return {
      module: 'disputes',
      action: 'get-one',
      disputeId,
      status: 'scaffolded',
    };
  }

  resolve(disputeId: string, payload: Record<string, unknown>) {
    return {
      module: 'disputes',
      action: 'resolve',
      disputeId,
      status: 'scaffolded',
      payload,
    };
  }
}
