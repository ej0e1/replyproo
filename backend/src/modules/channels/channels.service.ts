import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      const qrPayload = await this.getQrCodeWithRecovery(channel.evolutionInstanceName);
      qrCode = this.extractQrCode(qrPayload);
      remoteError = this.extractQrErrorMessage(qrPayload) ?? remoteError;
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
      remote = await this.fetchInstanceWithRecovery(channel.evolutionInstanceName);
    } catch (error) {
      remoteError = error instanceof Error ? error.message : 'Gagal refresh status';
    }

    const nextStatus = this.extractStatus(remote) ?? channel.status;

    const metadata = this.toObject(channel.metadata) ?? {};
    const lastQrError = typeof metadata.lastQrError === 'string' ? metadata.lastQrError : null;

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: nextStatus,
        qrCode: nextStatus === 'connected' ? null : channel.qrCode,
        lastConnectedAt: nextStatus === 'connected' ? new Date() : channel.lastConnectedAt,
        metadata: {
          ...metadata,
          remote: this.toJsonValue(remote),
          remoteError,
          lastQrError: nextStatus === 'connected' ? null : lastQrError,
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

  async updateChannelProfile(
    tenantId: string,
    channelId: string,
    body: {
      displayName?: string;
      phoneNumber?: string | null;
      showroomBranch?: string | null;
      salesOwner?: string | null;
    },
  ) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, tenantId },
    });

    if (!channel) {
      throw new NotFoundException('Channel tidak dijumpai');
    }

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName) {
      throw new BadRequestException('Nama channel wajib diisi');
    }

    if (displayName.length > 160) {
      throw new BadRequestException('Nama channel terlalu panjang (maksimum 160 aksara)');
    }

    const phoneNumber = this.normalizePhoneNumber(body.phoneNumber);
    const showroomBranch = this.normalizeOptionalText(body.showroomBranch, 120);
    const salesOwner = this.normalizeOptionalText(body.salesOwner, 120);
    const nowIso = new Date().toISOString();

    const metadata = this.toObject(channel.metadata) ?? {};
    const profile = this.toObject(metadata.profile) ?? {};

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        displayName,
        phoneNumber,
        metadata: {
          ...metadata,
          profile: {
            ...profile,
            showroomBranch,
            salesOwner,
            updatedAt: nowIso,
          },
          profileCompletedAt: nowIso,
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
    const normalizedDirect = this.normalizeQrCode(direct);
    if (normalizedDirect) {
      return normalizedDirect;
    }

    const nested = this.toObject(data?.qrcode) ?? this.toObject(data?.data);
    const nestedValue = nested?.base64 ?? nested?.qrcode ?? nested?.qr ?? nested?.code;
    return this.normalizeQrCode(nestedValue);
  }

  private extractQrErrorMessage(payload: unknown) {
    const data = this.toObject(payload);
    const nested = this.toObject(data?.data) ?? this.toObject(data?.qrcode);

    const candidates = [data?.message, data?.error, nested?.message, nested?.error];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private normalizeQrCode(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('data:image/')) {
      return normalized;
    }

    const compact = normalized.replace(/\s+/g, '');
    if (compact.length >= 128 && compact.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
      return `data:image/png;base64,${compact}`;
    }

    return null;
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
      await this.evolutionService.createInstance(instanceName);
    } catch (error) {
      if (!this.evolutionService.isInstanceAlreadyExistsError(error)) {
        return {
          provisioned: false,
          error: error instanceof Error ? error.message : 'Gagal create instance',
        };
      }
    }

    await this.evolutionService.setWebhook(instanceName, webhookUrl).catch(() => null);
    return { provisioned: true, error: null };
  }

  private async getQrCodeWithRecovery(instanceName: string) {
    try {
      return await this.evolutionService.getQrCode(instanceName);
    } catch (error) {
      if (!this.evolutionService.isInstanceNotFoundError(error)) {
        throw error;
      }

      await this.ensureInstance(instanceName);
      return this.evolutionService.getQrCode(instanceName);
    }
  }

  private async fetchInstanceWithRecovery(instanceName: string) {
    try {
      return await this.evolutionService.fetchInstance(instanceName);
    } catch (error) {
      if (this.evolutionService.isUnsupportedInstanceFetch(error)) {
        return null;
      }

      if (!this.evolutionService.isInstanceNotFoundError(error)) {
        throw error;
      }

      await this.ensureInstance(instanceName);
      return this.evolutionService.fetchInstance(instanceName);
    }
  }

  private toObject(value: unknown): Record<string, any> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : null;
  }

  private normalizePhoneNumber(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Nombor telefon tidak sah');
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > 30) {
      throw new BadRequestException('Nombor telefon terlalu panjang');
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined, maxLength: number) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Input profil channel tidak sah');
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`Input profil channel melebihi had ${maxLength} aksara`);
    }

    return normalized;
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
