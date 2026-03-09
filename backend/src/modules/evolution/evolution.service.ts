import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendMessagePayload = {
  instanceName: string;
  number: string;
  text: string;
};

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('EVOLUTION_API_URL', 'http://evolution-api:8080');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY', '');
  }

  async createInstance(instanceName: string) {
    const webhookUrl = this.configService.get<string>(
      'EVOLUTION_WEBHOOK_URL',
      'http://backend:3000/api/webhooks/evolution',
    );

    return this.request('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: true,
          events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
        },
      },
    });
  }

  async getQrCode(instanceName: string) {
    return this.request(`/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
    });
  }

  async sendTextMessage(payload: SendMessagePayload) {
    return this.request(`/message/sendText/${encodeURIComponent(payload.instanceName)}`, {
      method: 'POST',
      body: {
        number: payload.number,
        text: payload.text,
      },
    });
  }

  async fetchInstance(instanceName: string) {
    return this.request(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
      method: 'GET',
    });
  }

  async listInstances() {
    return this.request('/instance/fetchInstances', {
      method: 'GET',
    });
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    return this.request(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          webhookBase64: true,
          events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
        },
      },
    });
  }

  private async request(path: string, init: { method: string; body?: unknown }) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const raw = await response.text();
    const payload = raw ? this.tryParseJson(raw) : null;

    if (!response.ok) {
      this.logger.error(`Evolution API error ${response.status}: ${raw}`);
      throw new Error(`Evolution API request failed with status ${response.status}`);
    }

    return payload;
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
