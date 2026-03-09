import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { EvolutionService } from '../evolution/evolution.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionService: EvolutionService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async listChannels(tenantId: string) {
    return this.prisma.channel.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        evolutionInstanceName: true,
        status: true,
        qrCode: true,
        lastConnectedAt: true,
        metadata: true,
      },
    });
  }

  async connectChannel(tenantId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel tidak dijumpai');
    }

    const ensure = await this.ensureInstance(channel.evolutionInstanceName);
    let qrCode: string | null = null;
    let remoteError: string | null = ensure.error;

    try {
      const qrPayload = await this.evolutionService.getQrCode(channel.evolutionInstanceName);
      qrCode = this.extractQrCode(qrPayload);
    } catch (error) {
      remoteError = error instanceof Error ? error.message : 'Gagal mengambil QR';
    }

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: 'qr_pending',
        qrCode,
        metadata: {
          ...(this.toObject(channel.metadata) ?? {}),
          instanceProvisioned: ensure.provisioned,
          lastQrFetchAt: new Date().toISOString(),
          lastQrError: remoteError,
        },
      },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        evolutionInstanceName: true,
        status: true,
        qrCode: true,
        lastConnectedAt: true,
        metadata: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'channel.updated', updated);
    return updated;
  }

  async refreshChannelStatus(tenantId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel tidak dijumpai');
    }

    let remote: unknown = null;
    let remoteError: string | null = null;

    await this.ensureInstance(channel.evolutionInstanceName);

    try {
      remote = await this.evolutionService.fetchInstance(channel.evolutionInstanceName);
    } catch (error) {
      remoteError = error instanceof Error ? error.message : 'Gagal refresh status';
    }

    const nextStatus = this.extractStatus(remote) ?? channel.status;

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: nextStatus,
        lastConnectedAt: nextStatus === 'connected' ? new Date() : channel.lastConnectedAt,
        metadata: {
          ...(this.toObject(channel.metadata) ?? {}),
          remote: this.toJsonValue(remote),
          remoteError,
        },
      },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        evolutionInstanceName: true,
        status: true,
        qrCode: true,
        lastConnectedAt: true,
        metadata: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(tenantId, 'channel.updated', updated);
    return updated;
  }

  private extractQrCode(payload: unknown) {
    const data = this.toObject(payload);
    const direct = data?.base64 ?? data?.qr ?? data?.qrcode ?? data?.code;
    if (typeof direct === 'string') {
      return direct;
    }

    const nested = this.toObject(data?.qrcode) ?? this.toObject(data?.data);
    const nestedValue = nested?.base64 ?? nested?.qrcode ?? nested?.qr ?? nested?.code;
    return typeof nestedValue === 'string' ? nestedValue : JSON.stringify(payload ?? null);
  }

  private extractStatus(payload: unknown) {
    const data = this.extractInstanceRecord(payload);
    const candidate = data?.status ?? data?.state ?? this.toObject(data?.instance)?.status;
    if (typeof candidate !== 'string') {
      return null;
    }

    if (candidate.toLowerCase().includes('open') || candidate.toLowerCase().includes('connected')) {
      return 'connected' as const;
    }

    if (candidate.toLowerCase().includes('close') || candidate.toLowerCase().includes('disconnect')) {
      return 'disconnected' as const;
    }

    return null;
  }

  private extractInstanceRecord(payload: unknown) {
    if (Array.isArray(payload)) {
      return this.toObject(payload[0]);
    }

    const data = this.toObject(payload);
    if (!data) {
      return null;
    }

    if (Array.isArray(data.instances)) {
      return this.toObject(data.instances[0]);
    }

    if (Array.isArray(data.data)) {
      return this.toObject(data.data[0]);
    }

    return data;
  }

  private async ensureInstance(instanceName: string) {
    const webhookUrl = 'http://backend:3000/api/webhooks/evolution';

    try {
      const existing = await this.evolutionService.fetchInstance(instanceName);
      const record = this.extractInstanceRecord(existing);
      if (record) {
        await this.evolutionService.setWebhook(instanceName, webhookUrl).catch(() => null);
        return { provisioned: true, error: null };
      }
    } catch {
      // continue to create instance
    }

    try {
      await this.evolutionService.createInstance(instanceName);
      await this.evolutionService.setWebhook(instanceName, webhookUrl).catch(() => null);
      return { provisioned: true, error: null };
    } catch (error) {
      return {
        provisioned: false,
        error: error instanceof Error ? error.message : 'Gagal create instance',
      };
    }
  }

  private toObject(value: unknown): Record<string, any> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : null;
  }

  private toJsonValue(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
}
