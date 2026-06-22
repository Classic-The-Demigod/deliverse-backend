import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Get(':trackingToken')
  getPublicTracking(@Param('trackingToken') trackingToken: string) {
    return this.trackingService.getPublicTracking(trackingToken);
  }

  @Public()
  @Post(':trackingToken/confirm-receipt')
  confirmReceipt(
    @Param('trackingToken') trackingToken: string,
    @Body() payload: any,
  ) {
    return this.trackingService.confirmReceipt(trackingToken, payload);
  }

  @Public()
  @Post(':trackingToken/rate')
  rateExperience(
    @Param('trackingToken') trackingToken: string,
    @Body() payload: { rating: number; reviewText?: string },
  ) {
    return this.trackingService.rateExperience(trackingToken, payload);
  }
}
