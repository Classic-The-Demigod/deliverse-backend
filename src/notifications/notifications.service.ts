import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseAdmin: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.expo = new Expo();
  }

  /** Initialise Firebase Admin SDK once on module load using env-provided credentials */
  async onModuleInit() {
    try {
      const admin = require('firebase-admin');

      if (admin.apps.length > 0) {
        this.firebaseAdmin = admin;
        return;
      }

      const serviceAccountPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');

      if (serviceAccountPath) {
        // Path to downloaded service account JSON (set in .env, never committed)
        admin.initializeApp({
          credential: admin.credential.cert(require(serviceAccountPath)),
        });
      } else if (projectId) {
        // Fallback: individual env vars (useful for Railway / Render secrets)
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail: this.config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.config
              .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
              .replace(/\\n/g, '\n'),
          }),
        });
      } else {
        this.logger.warn(
          'Firebase Admin SDK not initialised — no FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID set. FCM push will be skipped.',
        );
        return;
      }

      this.firebaseAdmin = admin;
      this.logger.log('Firebase Admin SDK initialised.');
    } catch (err) {
      this.logger.error('Failed to initialise Firebase Admin SDK', err);
    }
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

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, fcmPushToken: true },
    });

    if (!user?.expoPushToken && !user?.fcmPushToken) {
      return;
    }

    // ── FCM Web Push ──────────────────────────────────────────────────────────
    if (user?.fcmPushToken && this.firebaseAdmin) {
      try {
        await this.firebaseAdmin.messaging().send({
          token: user.fcmPushToken,
          notification: { title, body },
          data: data
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)]),
              )
            : {},
        });
      } catch (error) {
        this.logger.error('Error sending FCM push notification', error);
      }
    }

    // ── Native Expo Push ──────────────────────────────────────────────────────
    if (user?.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
      const messages = [
        {
          to: user.expoPushToken,
          sound: 'default' as const,
          title,
          body,
          data: data || {},
        },
      ];

      try {
        const chunks = this.expo.chunkPushNotifications(messages);
        const tickets: any[] = [];
        for (const chunk of chunks) {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        }
        return tickets;
      } catch (error) {
        this.logger.error('Error sending Expo push notification', error);
      }
    }
  }

  async savePushToken(userId: string, token: string, provider: 'expo' | 'fcm' = 'expo') {
    if (provider === 'fcm') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmPushToken: token },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { expoPushToken: token },
      });
    }
    return { message: 'Push token saved successfully.' };
  }
}
