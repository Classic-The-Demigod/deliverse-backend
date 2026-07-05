import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getOverview() {
    return this.appService.getOverview();
  }

  @Public()
  @Get('businesses')
  async getBusinesses(@Query('category') category?: string) {
    return this.appService.getBusinesses(category);
  }
}
