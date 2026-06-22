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
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessageType } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) throw new Error('Missing token');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'deliverse-dev-access-secret'),
      });

      const userId = payload.sub;
      client.data.userId = userId;
      this.connectedUsers.set(userId, client.id);

      client.join(`user_${userId}`);
      console.log(`User ${userId} connected to chat via socket ${client.id}`);
    } catch (error) {
      console.error('Socket connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('join_session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (data.sessionId) {
      client.join(`session_${data.sessionId}`);
      console.log(`User ${client.data.userId} joined session ${data.sessionId}`);
    }
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (data.sessionId) {
      client.leave(`session_${data.sessionId}`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; content: string; type?: MessageType; mediaUrl?: string },
  ) {
    const userId = client.data.userId;
    console.log(`[ChatGateway] Received send_message from User ${userId} for Session ${data.sessionId}: ${data.content}`);

    if (!userId || !data.sessionId || !data.content) {
      console.warn(`[ChatGateway] Invalid message payload from ${userId}`);
      return;
    }

    try {
      const message = await this.chatService.saveMessage(
        data.sessionId,
        userId,
        data.content,
        data.type || MessageType.TEXT,
        data.mediaUrl
      );

      console.log(`[ChatGateway] Message saved, broadcasting to session_${data.sessionId}...`, message.id);
      // Broadcast to everyone in the session room (including sender to confirm delivery)
      this.server.to(`session_${data.sessionId}`).emit('new_message', message);
      
      // We could also emit to the individual user rooms of participants to show a notification if they aren't in the session room
      // This would require getting all participants from DB first.
    } catch (error) {
      console.error('[ChatGateway] Error sending message:', error.message);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.sessionId) return;
    
    try {
      await this.chatService.markMessagesAsRead(data.sessionId, userId);
      // Optional: Broadcast that messages were read
      // this.server.to(`session_${data.sessionId}`).emit('messages_read', { sessionId: data.sessionId, readBy: userId });
    } catch (error) {
      console.error('[ChatGateway] Error marking messages as read:', error.message);
    }
  }
}
