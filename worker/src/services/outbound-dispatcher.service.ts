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
      await this.evolutionClientService.createInstance(instanceName);
      return { ready: true, created: true };
    } catch (error) {
      if (this.evolutionClientService.isInstanceAlreadyExistsError(error)) {
        return { ready: true, created: false };
      }

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
}
