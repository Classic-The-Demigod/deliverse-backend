import { Injectable } from '@nestjs/common';

@Injectable()
export class TrackingEngineService {
  getDriverPingPolicySeconds() {
    return {
      activeTransitMin: 10,
      activeTransitMax: 15,
    };
  }
}
