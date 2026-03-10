import { Body, Controller, Param, Patch } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('internal/messages')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Patch(':messageId/status')
  async updateMessageStatus(
    @Param('messageId') messageId: string,
    @Body()
    body: {
      status: 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed';
      providerMessageId?: string | null;
      errorMessage?: string | null;
    },
  ) {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
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
      return { ok: false, message: 'Message tidak dijumpai' };
    }

    const now = new Date();
    const nextStatus = this.pickHigherStatus(existing, body.status);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status: nextStatus,
        providerMessageId: body.providerMessageId ?? undefined,
        errorMessage: body.errorMessage ?? undefined,
        sentAt:
          existing.sentAt ??
          (nextStatus === 'sent' || nextStatus === 'delivered' || nextStatus === 'read' ? now : undefined),
        deliveredAt: existing.deliveredAt ?? (nextStatus === 'delivered' || nextStatus === 'read' ? now : undefined),
        readAt: existing.readAt ?? (nextStatus === 'read' ? now : undefined),
        metadata: {
          ...this.toObject(existing.metadata),
          lastStatusUpdateAt: now.toISOString(),
        },
      },
      select: {
        id: true,
        conversationId: true,
        status: true,
        providerMessageId: true,
        errorMessage: true,
      },
    });

    this.realtimeGateway.emitTenantEvent(existing.tenantId, 'message.status', updated);
    this.realtimeGateway.emitTenantEvent(existing.tenantId, 'inbox.updated', {
      type: 'message.status',
      conversationId: existing.conversationId,
      messageId: existing.id,
    });

    return { ok: true, message: updated };
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private pickHigherStatus(
    existing: { status?: string | null } | null,
    incoming: 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed',
  ) {
    const rank: Record<string, number> = {
      queued: 0,
      processing: 1,
      failed: 1,
      sent: 2,
      delivered: 3,
      read: 4,
    };

    const current = existing?.status ?? 'queued';
    return (rank[incoming] ?? 0) >= (rank[current] ?? 0) ? incoming : (current as typeof incoming);
  }
}
