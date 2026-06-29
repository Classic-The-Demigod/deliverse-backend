import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BusinessOrdersModule } from './business-orders/business-orders.module';
import { DeliveryCoreModule } from './delivery-core/delivery-core.module';
import { DisputesModule } from './disputes/disputes.module';
import { DriverTasksModule } from './driver-tasks/driver-tasks.module';
import { OperatorJobsModule } from './operator-jobs/operator-jobs.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { TrackingModule } from './tracking/tracking.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MailModule } from './mail/mail.module';
import { UploadsModule } from './uploads/uploads.module';
import { ChatModule } from './chat/chat.module';
import { OperatorDashboardModule } from './operator-dashboard/operator-dashboard.module';
import { OperatorFleetModule } from './operator-fleet/operator-fleet.module';
import { OperatorSettingsModule } from './operator-settings/operator-settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { DeveloperModule } from './developer/developer.module';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL', 60000), // default 60s
          limit: config.get('THROTTLE_LIMIT', 60), // default 60 req/min
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    DeliveryCoreModule,
    AuthModule,
    BusinessOrdersModule,
    OperatorJobsModule,
    OperatorDashboardModule,
    DriverTasksModule,
    TrackingModule,
    PaymentsModule,
    DisputesModule,
    AdminModule,
    WebhooksModule,
    MailModule,
    NotificationsModule,
    UploadsModule,
    ChatModule,
    OperatorFleetModule,
    OperatorSettingsModule,
    DeveloperModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply LoggerMiddleware to all routes
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
