import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatSessionType, Role, MessageType } from '@prisma/client';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  createSession(
    @CurrentUser() user: any,
    @Body() body: { type: ChatSessionType; orderId?: string; targetUserId?: string },
  ) {
    console.log('[ChatController] CurrentUser decorator returned:', user);
    return this.chatService.createSession(user?.userId || user?.sub || user?.id, user?.role, body);
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: { userId: string }) {
    return this.chatService.getSessions(user.userId);
  }

  @Get('sessions/:sessionId/messages')
  getMessages(
    @CurrentUser() user: { userId: string },
    @Param('sessionId') sessionId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.chatService.getMessages(sessionId, user.userId, skip ? parseInt(skip) : 0, take ? parseInt(take) : 50);
  }

  @Post('sessions/:sessionId/messages')
  sendMessage(
    @CurrentUser() user: { userId: string },
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string; type?: MessageType; mediaUrl?: string },
  ) {
    return this.chatService.saveMessage(
      sessionId,
      user.userId,
      body.content,
      body.type || MessageType.TEXT,
      body.mediaUrl,
    );
  }
}
