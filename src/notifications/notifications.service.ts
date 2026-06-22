import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly expo: Expo;

  constructor(private readonly prisma: PrismaService) {
    this.expo = new Expo();
  }

  async getUserNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { data: notifications, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read.' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read.' };
  }

  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, any>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    if (!user?.expoPushToken) {
      return;
    }

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      console.warn(`Invalid Expo push token for user ${userId}`);
      return;
    }

    const messages = [{
      to: user.expoPushToken,
      sound: 'default' as any,
      title,
      body,
      data: data || {},
    }];

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: any[] = [];
      for (const chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }
      return tickets;
    } catch (error) {
      console.error('Error sending push notification', error);
    }
  }

  async savePushToken(userId: string, token: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: token },
    });
    return { message: 'Push token saved successfully.' };
  }
}
