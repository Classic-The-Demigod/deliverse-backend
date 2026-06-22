import { Injectable } from '@nestjs/common';

@Injectable()
export class PenaltyEngineService {
  getProtocolWindowsMinutes() {
    return {
      dispatchAssignmentWindow: 20,
      idleGraceWindow: 10,
      idlePenaltyWindow: 20,
      lateDeliveryPenaltyWindow: 20,
    };
  }
}
