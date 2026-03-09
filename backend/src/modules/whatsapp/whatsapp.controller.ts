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

  private async findChannelByInstance(instanceName?: string) {
    if (!instanceName) {
      return null;
    }

    return this.prisma.channel.findFirst({
      where: { evolutionInstanceName: instanceName },
      select: {
        id: true,
        tenantId: true,
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
}
