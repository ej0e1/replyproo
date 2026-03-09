import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async listContacts(tenantId: string) {
    return this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        tags: true,
        optIn: true,
        lastSeenAt: true,
      },
      take: 50,
    });
  }

  async listConversations(tenantId: string) {
    return this.prisma.conversation.findMany({
      where: { tenantId },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        unreadCount: true,
        aiEnabled: true,
        lastMessageAt: true,
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            tags: true,
          },
        },
        channel: {
          select: {
            id: true,
            displayName: true,
            phoneNumber: true,
            status: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            direction: true,
            content: true,
            status: true,
            createdAt: true,
          },
        },
      },
      take: 50,
    });
  }

  async getConversationMessages(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        aiEnabled: true,
        unreadCount: true,
        contact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            tags: true,
          },
        },
        channel: {
          select: {
            id: true,
            displayName: true,
            phoneNumber: true,
            status: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            direction: true,
            content: true,
            status: true,
            providerMessageId: true,
            createdAt: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation tidak dijumpai');
    }

    if (conversation.tenantId !== tenantId) {
      throw new ForbiddenException('Akses tenant tidak sah');
    }

    return conversation;
  }

  async sendMessage(tenantId: string, conversationId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        channel: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation tidak dijumpai');
    }

    if (conversation.tenantId !== tenantId) {
      throw new ForbiddenException('Akses tenant tidak sah');
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        channelId: conversation.channelId,
        contactId: conversation.contactId,
        direction: 'outbound',
        content,
        status: 'queued',
        metadata: {
          source: 'dashboard',
        },
        queuedAt: new Date(),
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    await this.queueService.enqueueMessageSend({
      tenantId,
      channelId: conversation.channelId,
      instanceName: conversation.channel.evolutionInstanceName,
      conversationId: conversation.id,
      messageId: message.id,
      to: conversation.contact.phoneNumber,
      content,
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'message.queued', {
      conversationId: conversation.id,
      message,
    });
    this.realtimeGateway.emitTenantEvent(tenantId, 'inbox.updated', {
      conversationId: conversation.id,
      type: 'message.queued',
    });

    return message;
  }
}
