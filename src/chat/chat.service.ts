import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatSessionType, Role, MessageType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, userRole: Role, payload: { type: ChatSessionType, orderId?: string, targetUserId?: string }) {
    if (payload.type === ChatSessionType.ORDER) {
      if (!payload.orderId) throw new BadRequestException('orderId is required for ORDER chat');
      
      const order = await this.prisma.order.findUnique({ 
        where: { id: payload.orderId },
        include: { driver: true, operator: true }
      });
      if (!order) throw new NotFoundException('Order not found');

      // Check permissions
      if (
        userRole !== Role.ADMIN && 
        userId !== order.userId && 
        userId !== order.driver?.userId
      ) {
        console.log(`[ChatService Debug] 403 Forbidden. Current user: ${userId} (Role: ${userRole}). Order user: ${order.userId}, Driver user: ${order.driver?.userId}`);
        throw new ForbiddenException('You do not have access to this order chat');
      }

      // Check if session already exists
      let session = await this.prisma.chatSession.findUnique({
        where: { orderId: order.id },
        include: { participants: true },
      });

      if (!session) {
        session = await this.prisma.chatSession.create({
          data: {
            type: ChatSessionType.ORDER,
            orderId: order.id,
            participants: {
              create: [
                { userId: order.userId },
                ...(order.driver?.userId ? [{ userId: order.driver.userId }] : []),
              ],
            },
          },
          include: { participants: true },
        });
      } else {
        // Dynamic Participant Sync: If the driver was assigned after the chat session
        // was initially created, add them as participants dynamically so they can access the chat.
        const sessionId = session.id;
        const existingUserIds = session.participants.map(p => p.userId);
        const missingUserIds: string[] = [];
        
        if (order.driver?.userId && !existingUserIds.includes(order.driver.userId)) {
          missingUserIds.push(order.driver.userId);
        }
        
        if (missingUserIds.length > 0) {
          await this.prisma.chatParticipant.createMany({
            data: missingUserIds.map(uId => ({
              sessionId,
              userId: uId,
            })),
          });
          
          // Re-fetch the session with the new participants included
          session = await this.prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: { participants: true },
          });
        }
      }
      return session;

    } else if (payload.type === ChatSessionType.DIRECT) {
      if (!payload.targetUserId) throw new BadRequestException('targetUserId is required for DIRECT chat');
      const targetUser = await this.prisma.user.findUnique({
        where: { id: payload.targetUserId },
        select: { role: true },
      });
      if (!targetUser) throw new NotFoundException('Target user not found');

      if (userRole === Role.USER) {
        throw new ForbiddenException('Users cannot initiate direct chats');
      }
      if (userRole === Role.DRIVER && targetUser.role !== Role.OPERATOR) {
        throw new ForbiddenException('Drivers can only initiate direct chats with operators');
      }

      // Find existing direct session between these two users
      let session = await this.prisma.chatSession.findFirst({
        where: {
          type: ChatSessionType.DIRECT,
          participants: {
            every: {
              userId: { in: [userId, payload.targetUserId] },
            },
          },
        },
        include: { participants: true },
      });

      if (!session) {
        session = await this.prisma.chatSession.create({
          data: {
            type: ChatSessionType.DIRECT,
            participants: {
              create: [
                { userId },
                { userId: payload.targetUserId },
              ],
            },
          },
          include: { participants: true },
        });
      }
      return session;

    } else if (payload.type === ChatSessionType.SUPPORT) {
      if (payload.orderId) {
        const order = await this.prisma.order.findUnique({ 
          where: { id: payload.orderId },
          include: { operator: true }
        });
        if (!order || !order.operator?.userId) throw new NotFoundException('Order or Operator not found');

        // Find an existing support session for this order where the current user is already a participant
        let session = await this.prisma.chatSession.findFirst({
          where: {
            type: ChatSessionType.SUPPORT,
            orderId: order.id,
            participants: {
              some: { userId },
            },
          },
          include: { participants: true },
        });

        if (!session) {
          // Participants: always include requesting user (driver OR customer) + operator
          const participantUserIds = Array.from(new Set([userId, order.operator.userId]));
          session = await this.prisma.chatSession.create({
            data: {
              type: ChatSessionType.SUPPORT,
              orderId: order.id,
              participants: {
                create: participantUserIds.map(uId => ({ userId: uId })),
              },
            },
            include: { participants: true },
          });
        }
        return session;
      } else {
        // Generic support without orderId - connect with an admin
        // Find an admin user
        const admin = await this.prisma.user.findFirst({
          where: { role: Role.ADMIN },
        });
        if (!admin) throw new NotFoundException('No admin available for support');

        let session = await this.prisma.chatSession.findFirst({
          where: {
            type: ChatSessionType.SUPPORT,
            orderId: null,
            participants: {
              some: { userId },
            },
          },
          include: { participants: true },
        });

        if (!session) {
          session = await this.prisma.chatSession.create({
            data: {
              type: ChatSessionType.SUPPORT,
              participants: {
                create: [
                  { userId },
                  { userId: admin.id },
                ],
              },
            },
            include: { participants: true },
          });
        }
        return session;
      }
    }

    throw new BadRequestException('Invalid chat session type');
  }

  async getSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                businessProfile: { select: { businessName: true } },
                operatorProfile: { select: { companyName: true } },
                driverProfile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMessages(sessionId: string, userId: string, skip = 0, take = 50) {
    // Verify participant
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant in this chat');

    return this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            operatorProfile: { select: { companyName: true } },
            driverProfile: { select: { firstName: true, lastName: true } },
          }
        }
      }
    });
  }

  async saveMessage(sessionId: string, senderId: string, content: string, type: MessageType, mediaUrl?: string) {
    // Verify sender is participant
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId: senderId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant in this chat');

    const message = await this.prisma.message.create({
      data: {
        sessionId,
        senderId,
        content,
        type,
        mediaUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            operatorProfile: { select: { companyName: true } },
            driverProfile: { select: { firstName: true, lastName: true } },
          }
        }
      }
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markMessagesAsRead(sessionId: string, userId: string) {
    // Verify participant
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!participant) return;

    // Update messages in this session where sender is NOT the current user
    await this.prisma.message.updateMany({
      where: {
        sessionId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }
}
