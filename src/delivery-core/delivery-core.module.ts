import { Global, Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { DeliveryStateMachineService } from './delivery-state-machine.service';
import { GeofenceService } from './geofence.service';
import { PenaltyEngineService } from './penalty-engine.service';
import { TrackingEngineService } from './tracking-engine.service';

@Global()
@Module({
  providers: [
    DeliveryStateMachineService,
    GeofenceService,
    PenaltyEngineService,
    EscrowService,
    TrackingEngineService,
  ],
  exports: [
    DeliveryStateMachineService,
    GeofenceService,
    PenaltyEngineService,
    EscrowService,
    TrackingEngineService,
  ],
})
export class DeliveryCoreModule {}
