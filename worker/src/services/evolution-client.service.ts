import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class EvolutionClientRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly raw: string,
    readonly payload: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class EvolutionClientService {
  private readonly logger = new Logger(EvolutionClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('EVOLUTION_API_URL', 'http://evolution-api:8080');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY', '');
  }

  async sendTextMessage(instanceName: string, number: string, text: string) {
    const response = await fetch(
      `${this.baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({ number, text }),
      },
    );

    const raw = await response.text();
    const payload = raw ? this.tryParseJson(raw) : null;

    if (!response.ok) {
      this.logger.error(`Evolution send error ${response.status}: ${raw}`);
      throw new Error(`Evolution send failed with status ${response.status}`);
    }

    return payload;
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

  async fetchInstance(instanceName: string) {
    return this.request(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
      method: 'GET',
    });
  }

  async updateMessageStatus(
    messageId: string,
    body: {
      status: 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed';
      providerMessageId?: string | null;
      errorMessage?: string | null;
    },
  ) {
    const backendBase = this.configService.get<string>('BACKEND_INTERNAL_URL', 'http://backend:3000/api');
    const response = await fetch(`${backendBase}/internal/messages/${encodeURIComponent(messageId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const raw = await response.text();
      this.logger.error(`Backend message status update failed ${response.status}: ${raw}`);
    }
  }

  isInstanceAlreadyExistsError(error: unknown) {
    if (!(error instanceof EvolutionClientRequestError)) {
      return false;
    }

    const raw = error.raw.toLowerCase();
    return (
      raw.includes('already exists') ||
      raw.includes('already exist') ||
      raw.includes('instance exists') ||
      raw.includes('already in use')
    );
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
      this.logger.error(`Evolution send error ${response.status}: ${raw}`);
      throw new EvolutionClientRequestError(
        `Evolution send failed with status ${response.status}`,
        response.status,
        raw,
        payload,
      );
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
