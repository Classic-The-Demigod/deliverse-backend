import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Allow passing token in auth payload or headers or cookies
      let token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        // Try parsing from cookies if not provided explicitly
        const cookies = client.handshake.headers.cookie;
        if (cookies) {
          const accessTokenCookie = cookies.split(';').find(c => c.trim().startsWith('accessToken='));
          if (accessTokenCookie) {
            token = accessTokenCookie.split('=')[1];
          }
        }
      }

      if (!token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'deliverse-dev-access-secret'),
      });

      const userId = payload.sub;
      client.data.userId = userId;
      client.data.role = payload.role;
      this.connectedUsers.set(userId, client.id);

      // Admins and Operators join specific rooms to receive all global updates
      if (payload.role === Role.ADMIN) {
        client.join('admins');
        console.log(`Admin ${userId} connected to tracking via socket ${client.id}`);
      } else if (payload.role === Role.OPERATOR) {
        client.join('operators'); // Could be specific operator ID later
      }

      // Everyone joins their own user room
      client.join(`user_${userId}`);
    } catch (error) {
      console.error('Tracking socket connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
    }
  }

  @SubscribeMessage('subscribe_order')
  handleSubscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (data.orderId) {
      client.join(`order_${data.orderId}`);
      console.log(`User ${client.data.userId} subscribed to order ${data.orderId}`);
    }
  }

  @SubscribeMessage('unsubscribe_order')
  handleUnsubscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (data.orderId) {
      client.leave(`order_${data.orderId}`);
    }
  }

  // --- Utility methods to emit events from other services ---

  broadcastOrderStatusChange(order: any) {
    // Send to anyone directly watching the order
    this.server.to(`order_${order.id}`).emit('order_status_changed', order);
    
    // Also send to all admins
    this.server.to('admins').emit('order_status_changed', order);
  }

  broadcastDriverLocation(driverId: string, lat: number, lng: number) {
    this.server.to('admins').emit('driver_location_updated', { driverId, lat, lng });
  }
}
