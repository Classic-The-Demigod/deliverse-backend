import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getUserNotifications(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post(':id/read')
  markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Post('read-all')
  markAllAsRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('push-token')
  savePushToken(
    @CurrentUser('userId') userId: string,
    @Body('token') token: string,
    @Body('provider') provider?: 'expo' | 'fcm',
  ) {
    return this.notificationsService.savePushToken(userId, token, provider || 'expo');
  }
}
