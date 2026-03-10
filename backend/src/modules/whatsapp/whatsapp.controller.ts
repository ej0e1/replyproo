import { Body, Controller, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('webhooks/evolution')
export class WhatsAppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Post()
  async handleEvolutionWebhook(@Body() payload: any) {
    const event = String(payload?.event ?? '').toLowerCase();

    if (event === 'connection.update') {
      return this.handleConnectionUpdate(payload);
    }

    if (event === 'qrcode.updated') {
      return this.handleQrUpdated(payload);
    }

    if (event === 'messages.upsert' || event === 'messages.update') {
      return this.handleMessageEvent(payload);
    }

    const channel = await this.findChannelByInstance(payload?.instance ?? payload?.channelId);
    const tenantId = channel?.tenantId ?? payload?.tenantId ?? 'default-tenant';
    const channelId = channel?.id ?? payload?.instance ?? payload?.channelId ?? 'default-channel';
    const messageId = payload?.data?.key?.id ?? randomUUID();

    await this.queueService.enqueueInboundMessage({
      tenantId,
      channelId,
      messageId,
      rawEvent: payload,
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'inbox.updated', {
      type: 'incoming.webhook',
      messageId,
      channelId,
    });

    return { ok: true, queued: true, messageId };
  }

  @Post('messages-upsert')
  async handleMessagesUpsert(@Body() payload: any) {
    return this.handleMessageEvent({ ...payload, event: payload?.event ?? 'messages.upsert' });
  }

  @Post('messages-update')
  async handleMessagesUpdate(@Body() payload: any) {
    return this.handleMessageEvent({ ...payload, event: payload?.event ?? 'messages.update' });
  }

  @Post('connection-update')
  async handleConnectionUpdate(@Body() payload: any) {
    const instanceName = payload?.instance ?? payload?.data?.instance;
    const state = payload?.data?.state ?? payload?.state ?? null;
    const channel = await this.findChannelByInstance(instanceName);

    if (!channel) {
      return { ok: true, ignored: true };
    }

    const nextStatus = this.mapConnectionState(state) ?? channel.status;
    const metadata = this.toObject(channel.metadata);

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: nextStatus,
        lastConnectedAt: nextStatus === 'connected' ? new Date() : channel.lastConnectedAt,
        metadata: {
          ...metadata,
          connectionState: state,
          connectionUpdatedAt: new Date().toISOString(),
        },
      },
      select: {
        id: true,
        tenantId: true,
        displayName: true,
        status: true,
        qrCode: true,
        lastConnectedAt: true,
        metadata: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(channel.tenantId, 'channel.updated', updated);
    return { ok: true };
  }

  @Post('qrcode-updated')
  async handleQrUpdated(@Body() payload: any) {
    const instanceName = payload?.instance ?? payload?.data?.instance;
    const channel = await this.findChannelByInstance(instanceName);

    if (!channel) {
      return { ok: true, ignored: true };
    }

    const qrCode = this.extractQrCode(payload);
    const metadata = this.toObject(channel.metadata);

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: 'qr_pending',
        qrCode,
        metadata: {
          ...metadata,
          lastQrEventAt: new Date().toISOString(),
        },
      },
      select: {
        id: true,
        tenantId: true,
        displayName: true,
        status: true,
        qrCode: true,
        lastConnectedAt: true,
        metadata: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(channel.tenantId, 'channel.updated', updated);
    return { ok: true };
  }

  private async handleMessageEvent(payload: any) {
    const instanceName = payload?.instance ?? payload?.data?.instance;
    const channel = await this.findChannelByInstance(instanceName);

    if (!channel) {
      return { ok: true, ignored: true };
    }

    const messageData = this.extractMessageData(payload);
    const providerMessageId = messageData?.key?.id;
    const remoteJid = messageData?.key?.remoteJid ?? messageData?.key?.remoteJidAlt;
    const fromMe = Boolean(messageData?.key?.fromMe);
    const messageStatus = this.mapMessageStatus(messageData?.status ?? payload?.status);

    if (fromMe && providerMessageId && messageStatus) {
      await this.updateOutboundMessageStatus(channel, providerMessageId, messageStatus, payload);
      return { ok: true, updated: true, direction: 'outbound' };
    }

    const phoneNumber = this.extractPhoneNumber(remoteJid);
    if (!phoneNumber || fromMe) {
      return { ok: true, ignored: true };
    }

    const content = this.extractMessageText(messageData);
    const occurredAt = this.extractOccurredAt(messageData?.messageTimestamp);

    const contact = await this.prisma.contact.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: channel.tenantId,
          phoneNumber,
        },
      },
      update: {
        name: messageData?.pushName ?? undefined,
        lastSeenAt: occurredAt,
      },
      create: {
        tenantId: channel.tenantId,
        phoneNumber,
        name: messageData?.pushName ?? null,
        lastSeenAt: occurredAt,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        phoneNumber: true,
      },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        contactId: contact.id,
      },
      select: {
        id: true,
        tenantId: true,
        unreadCount: true,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId: channel.tenantId,
          channelId: channel.id,
          contactId: contact.id,
          status: 'open',
          lastMessageAt: occurredAt,
          unreadCount: 0,
        },
        select: {
          id: true,
          tenantId: true,
          unreadCount: true,
        },
      });
    }

    const existingMessage = providerMessageId
      ? await this.prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            providerMessageId,
          },
          select: { id: true },
        })
      : null;

    if (!existingMessage) {
      await this.prisma.message.create({
        data: {
          tenantId: channel.tenantId,
          conversationId: conversation.id,
          channelId: channel.id,
          contactId: contact.id,
          direction: 'inbound',
          providerMessageId: providerMessageId ?? null,
          content,
          status: 'delivered',
          sentAt: occurredAt,
          deliveredAt: occurredAt,
          metadata: {
            event: payload?.event ?? 'messages.upsert',
            rawEvent: payload,
          },
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: occurredAt,
          unreadCount: {
            increment: 1,
          },
          status: 'open',
        },
      });

      await this.triggerKeywordAutomation({
        tenantId: channel.tenantId,
        channelId: channel.id,
        instanceName: channel.evolutionInstanceName,
        conversationId: conversation.id,
        contactId: contact.id,
        phoneNumber,
        triggerMessageId: providerMessageId ?? null,
        content,
      });
    }

    this.realtimeGateway.emitTenantEvent(channel.tenantId, 'inbox.updated', {
      type: 'incoming.message',
      conversationId: conversation.id,
      channelId: channel.id,
      phoneNumber,
    });

    return {
      ok: true,
      direction: 'inbound',
      conversationId: conversation.id,
      phoneNumber,
    };
  }

  private async findChannelByInstance(instanceName?: string) {
    if (!instanceName) {
      return null;
    }

    return this.prisma.channel.findFirst({
      where: { evolutionInstanceName: instanceName },
      select: {
        id: true,
        tenantId: true,
        displayName: true,
        evolutionInstanceName: true,
        status: true,
        metadata: true,
        qrCode: true,
        lastConnectedAt: true,
      },
    });
  }

  private mapConnectionState(state?: string | null) {
    if (!state) {
      return null;
    }

    const normalized = state.toLowerCase();
    if (normalized.includes('open') || normalized.includes('connected')) {
      return 'connected' as const;
    }
    if (normalized.includes('connecting') || normalized.includes('qr')) {
      return 'qr_pending' as const;
    }
    if (normalized.includes('close') || normalized.includes('disconnect')) {
      return 'disconnected' as const;
    }

    return null;
  }

  private mapMessageStatus(status?: string | null) {
    if (!status) {
      return null;
    }

    const normalized = status.toLowerCase();
    if (normalized.includes('read')) {
      return 'read' as const;
    }
    if (normalized.includes('delivery') || normalized.includes('delivered')) {
      return 'delivered' as const;
    }
    if (
      normalized.includes('server') ||
      normalized.includes('sent') ||
      normalized.includes('ack') ||
      normalized.includes('played')
    ) {
      return 'sent' as const;
    }

    return null;
  }

  private extractMessageData(payload: any) {
    if (Array.isArray(payload?.data)) {
      return payload.data[0] ?? null;
    }

    return payload?.data ?? null;
  }

  private extractPhoneNumber(remoteJid?: string | null) {
    if (!remoteJid || typeof remoteJid !== 'string') {
      return null;
    }

    if (remoteJid.includes('@g.us') || remoteJid.includes('status@')) {
      return null;
    }

    return remoteJid.split('@')[0] ?? null;
  }

  private extractOccurredAt(timestamp?: number | string | null) {
    if (!timestamp) {
      return new Date();
    }

    const numeric = Number(timestamp);
    if (Number.isNaN(numeric)) {
      return new Date();
    }

    const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    return new Date(millis);
  }

  private extractMessageText(messageData: any) {
    const message = messageData?.message;
    if (!message || typeof message !== 'object') {
      return null;
    }

    return (
      message?.conversation ??
      message?.extendedTextMessage?.text ??
      message?.imageMessage?.caption ??
      message?.videoMessage?.caption ??
      message?.documentMessage?.caption ??
      message?.buttonsResponseMessage?.selectedDisplayText ??
      message?.templateButtonReplyMessage?.selectedDisplayText ??
      message?.listResponseMessage?.title ??
      message?.ephemeralMessage?.message?.conversation ??
      message?.ephemeralMessage?.message?.extendedTextMessage?.text ??
      null
    );
  }

  private async triggerKeywordAutomation(params: {
    tenantId: string;
    channelId: string;
    instanceName: string;
    conversationId: string;
    contactId: string;
    phoneNumber: string;
    triggerMessageId: string | null;
    content: string | null;
  }) {
    const normalizedContent = params.content?.trim().toLowerCase();
    if (!normalizedContent) {
      return null;
    }

    const workflows = await this.prisma.workflowDefinition.findMany({
      where: {
        tenantId: params.tenantId,
        type: {
          in: ['keyword', 'ai_reply'],
        },
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        triggerConfig: true,
        stepsConfig: true,
      },
    });

    for (const workflow of workflows) {
      const keywords = this.extractKeywords(workflow.triggerConfig);
      const matchedKeyword = keywords.find((keyword) => normalizedContent.includes(keyword));
      if (!matchedKeyword) {
        continue;
      }

      const replyText = this.extractAutomationReply(workflow.stepsConfig, matchedKeyword);
      if (!replyText) {
        continue;
      }

      const queuedMessage = await this.prisma.message.create({
        data: {
          tenantId: params.tenantId,
          conversationId: params.conversationId,
          channelId: params.channelId,
          contactId: params.contactId,
          direction: 'outbound',
          content: replyText,
          status: 'queued',
          queuedAt: new Date(),
          metadata: {
            source: 'keyword-automation',
            workflowId: workflow.id,
            workflowName: workflow.name,
            matchedKeyword,
            triggerMessageId: params.triggerMessageId,
          },
        },
        select: {
          id: true,
          content: true,
          status: true,
          createdAt: true,
        },
      });

      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      await this.queueService.enqueueMessageSend({
        tenantId: params.tenantId,
        channelId: params.channelId,
        instanceName: params.instanceName,
        conversationId: params.conversationId,
        messageId: queuedMessage.id,
        to: params.phoneNumber,
        content: replyText,
      });

      this.realtimeGateway.emitTenantEvent(params.tenantId, 'message.queued', {
        conversationId: params.conversationId,
        message: queuedMessage,
      });
      this.realtimeGateway.emitTenantEvent(params.tenantId, 'inbox.updated', {
        type: 'automation.keyword',
        conversationId: params.conversationId,
        messageId: queuedMessage.id,
      });

      return { workflowId: workflow.id, matchedKeyword };
    }

    return null;
  }

  private async updateOutboundMessageStatus(
    channel: { id: string; tenantId: string },
    providerMessageId: string,
    status: 'sent' | 'delivered' | 'read',
    payload: any,
  ) {
    const existing = await this.prisma.message.findFirst({
      where: {
        channelId: channel.id,
        providerMessageId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        conversationId: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        metadata: true,
      },
    });

    if (!existing) {
      return;
    }

    const now = new Date();
    const nextStatus = this.pickHigherMessageStatus(existing.status, status);
    const updated = await this.prisma.message.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        sentAt:
          existing.sentAt ??
          (nextStatus === 'sent' || nextStatus === 'delivered' || nextStatus === 'read' ? now : undefined),
        deliveredAt: existing.deliveredAt ?? (nextStatus === 'delivered' || nextStatus === 'read' ? now : undefined),
        readAt: existing.readAt ?? (nextStatus === 'read' ? now : undefined),
        metadata: {
          ...this.toObject(existing.metadata),
          lastWebhookEvent: payload?.event ?? 'messages.upsert',
          lastWebhookStatus: nextStatus,
          lastWebhookAt: now.toISOString(),
        },
      },
      select: {
        id: true,
        conversationId: true,
        status: true,
        providerMessageId: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(channel.tenantId, 'message.status', updated);
    this.realtimeGateway.emitTenantEvent(channel.tenantId, 'inbox.updated', {
      type: 'message.status',
      conversationId: existing.conversationId,
      messageId: existing.id,
    });
  }

  private extractQrCode(payload: any) {
    return (
      payload?.qrcode?.base64 ??
      payload?.qrcode?.code ??
      payload?.data?.qrcode?.base64 ??
      payload?.data?.qrcode ??
      payload?.data?.base64 ??
      payload?.base64 ??
      JSON.stringify(payload ?? null)
    );
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private extractKeywords(value: unknown) {
    const config = this.toObject(value);
    const keywords = config.keywords;
    if (!Array.isArray(keywords)) {
      return [] as string[];
    }

    return keywords
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private extractAutomationReply(value: unknown, matchedKeyword: string) {
    const config = this.toObject(value);
    const directReply = config.replyText;
    if (typeof directReply === 'string' && directReply.trim()) {
      return directReply.trim();
    }

    return `Terima kasih. Kami terima pertanyaan tentang ${matchedKeyword} dan akan balas dengan lebih lanjut sebentar lagi.`;
  }

  private pickHigherMessageStatus(current: string | null | undefined, incoming: 'sent' | 'delivered' | 'read') {
    const rank: Record<string, number> = {
      queued: 0,
      processing: 1,
      failed: 1,
      sent: 2,
      delivered: 3,
      read: 4,
    };

    const existing = current ?? 'queued';
    return (rank[incoming] ?? 0) >= (rank[existing] ?? 0) ? incoming : (existing as typeof incoming);
  }
}
