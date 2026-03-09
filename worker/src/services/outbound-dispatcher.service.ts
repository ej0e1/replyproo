import { Injectable } from '@nestjs/common';
import { EvolutionClientService } from './evolution-client.service';

@Injectable()
export class OutboundDispatcherService {
  constructor(private readonly evolutionClientService: EvolutionClientService) {}

  updateMessageStatus(
    messageId: string,
    body: {
      status: 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed';
      providerMessageId?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return this.evolutionClientService.updateMessageStatus(messageId, body);
  }

  async ensureInstance(instanceName: string) {
    try {
      const existing = await this.evolutionClientService.fetchInstance(instanceName);
      const record = this.extractRecord(existing);
      if (record) {
        return { ready: true, created: false };
      }
    } catch {
      // continue to create
    }

    try {
      await this.evolutionClientService.createInstance(instanceName);
      return { ready: true, created: true };
    } catch {
      return { ready: false, created: false };
    }
  }

  async sendViaEvolution(data: {
    channelId: string;
    to: string;
    content: string;
  }) {
    const response = await this.evolutionClientService.sendTextMessage(
      data.channelId,
      data.to,
      data.content,
    );

    return {
      success: true,
      providerMessageId: response?.key?.id ?? response?.message?.key?.id ?? `ev-${Date.now()}`,
      raw: response,
      ...data,
    };
  }

  private extractRecord(payload: unknown) {
    if (Array.isArray(payload)) {
      return payload[0] ?? null;
    }

    if (payload && typeof payload === 'object') {
      const data = payload as Record<string, unknown>;
      if (Array.isArray(data.instances)) {
        return data.instances[0] ?? null;
      }
      if (Array.isArray(data.data)) {
        return data.data[0] ?? null;
      }
      return payload;
    }

    return null;
  }
}
