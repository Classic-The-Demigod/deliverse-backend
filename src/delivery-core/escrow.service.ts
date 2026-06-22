import { Injectable } from '@nestjs/common';

@Injectable()
export class EscrowService {
  getSplitRule() {
    return {
      platformFeePercent: 5,
      operatorSettlementPercent: 95,
    };
  }
}
