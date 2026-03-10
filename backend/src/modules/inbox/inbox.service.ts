import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const DEALER_LEAD_STAGES = [
  'new_lead',
  'follow_up',
  'test_drive',
  'booking',
  'loan_submitted',
  'won',
  'lost',
] as const;

type DealerLeadStage = (typeof DEALER_LEAD_STAGES)[number];

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async listContacts(tenantId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        email: true,
        tags: true,
        customFields: true,
        optIn: true,
        lastSeenAt: true,
      },
      take: 50,
    });

    return contacts.map((contact) => ({
      ...contact,
      leadStage: this.extractLeadStage(contact.customFields),
    }));
  }

  async listConversations(tenantId: string) {
    const conversations = await this.prisma.conversation.findMany({
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
            customFields: true,
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

    return conversations.map((conversation) => ({
      ...conversation,
      contact: {
        ...conversation.contact,
        leadStage: this.extractLeadStage(conversation.contact.customFields),
      },
    }));
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
            customFields: true,
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

    return {
      ...conversation,
      contact: {
        ...conversation.contact,
        leadStage: this.extractLeadStage(conversation.contact.customFields),
      },
    };
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

  async updateLeadStage(
    tenantId: string,
    userId: string,
    conversationId: string,
    stage: DealerLeadStage,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        tenantId: true,
        contactId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation tidak dijumpai');
    }

    if (conversation.tenantId !== tenantId) {
      throw new ForbiddenException('Akses tenant tidak sah');
    }

    await this.ensureTenantMember(tenantId, userId);

    const currentContact = await this.prisma.contact.findUnique({
      where: { id: conversation.contactId },
      select: {
        customFields: true,
      },
    });

    const updatedCustomFields = {
      ...this.toObject(currentContact?.customFields),
      leadStage: stage,
      leadStageUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.contact.update({
      where: { id: conversation.contactId },
      data: {
        customFields: updatedCustomFields,
      },
    });

    const refreshed = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
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
            customFields: true,
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
    });

    const payload = {
      ...refreshed,
      contact: refreshed
        ? {
            ...refreshed.contact,
            leadStage: this.extractLeadStage(refreshed.contact.customFields),
          }
        : null,
    };

    this.realtimeGateway.emitTenantEvent(tenantId, 'inbox.updated', {
      type: 'conversation.leadStage',
      conversationId,
      leadStage: stage,
    });

    return payload;
  }

  async updateConversationStatus(
    tenantId: string,
    userId: string,
    conversationId: string,
    status: 'open' | 'pending' | 'resolved' | 'closed',
  ) {
    const conversation = await this.requireConversationAccess(tenantId, conversationId);
    await this.ensureTenantMember(tenantId, userId);

    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { status },
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
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'inbox.updated', {
      type: 'conversation.status',
      conversationId: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async updateConversationAssignee(
    tenantId: string,
    userId: string,
    conversationId: string,
    action: 'assign_to_me' | 'unassign',
  ) {
    const conversation = await this.requireConversationAccess(tenantId, conversationId);
    await this.ensureTenantMember(tenantId, userId);

    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        assignedToUserId: action === 'assign_to_me' ? userId : null,
        status: action === 'assign_to_me' ? 'pending' : conversation.status,
      },
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
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'inbox.updated', {
      type: 'conversation.assignee',
      conversationId: updated.id,
      assignedToUserId: updated.assignedToUser?.id ?? null,
    });

    return updated;
  }

  private async requireConversationAccess(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        tenantId: true,
        status: true,
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

  private async ensureTenantMember(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('Akses tenant tidak sah');
    }
  }

  private extractLeadStage(customFields: unknown): DealerLeadStage {
    const leadStage = this.toObject(customFields).leadStage;
    if (typeof leadStage === 'string' && DEALER_LEAD_STAGES.includes(leadStage as DealerLeadStage)) {
      return leadStage as DealerLeadStage;
    }

    return 'new_lead';
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
