import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type KeywordReplySettings = {
  workflowId: string | null;
  name: string;
  isActive: boolean;
  keywords: string[];
  replyText: string;
};

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKeywordReplySettings(tenantId: string): Promise<KeywordReplySettings> {
    const workflow = await this.findKeywordWorkflow(tenantId);

    return {
      workflowId: workflow?.id ?? null,
      name: workflow?.name ?? 'Keyword Auto Reply',
      isActive: workflow?.isActive ?? false,
      keywords: this.extractKeywords(workflow?.triggerConfig),
      replyText: this.extractReplyText(workflow?.stepsConfig),
    };
  }

  async saveKeywordReplySettings(
    tenantId: string,
    body: { isActive?: boolean; keywords?: string[]; replyText?: string; name?: string },
  ): Promise<KeywordReplySettings> {
    const keywords = this.normalizeKeywords(body.keywords ?? []);
    const replyText = typeof body.replyText === 'string' ? body.replyText.trim() : '';
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Keyword Auto Reply';
    const isActive = Boolean(body.isActive);

    const existing = await this.findKeywordWorkflow(tenantId);
    const saved = existing
      ? await this.prisma.workflowDefinition.update({
          where: { id: existing.id },
          data: {
            name,
            type: 'keyword',
            isActive,
            triggerConfig: {
              keywords,
            },
            stepsConfig: {
              replyText,
              fallbackToHuman: true,
            },
          },
          select: {
            id: true,
            name: true,
            isActive: true,
            triggerConfig: true,
            stepsConfig: true,
          },
        })
      : await this.prisma.workflowDefinition.create({
          data: {
            tenantId,
            name,
            type: 'keyword',
            isActive,
            triggerConfig: {
              keywords,
            },
            stepsConfig: {
              replyText,
              fallbackToHuman: true,
            },
          },
          select: {
            id: true,
            name: true,
            isActive: true,
            triggerConfig: true,
            stepsConfig: true,
          },
        });

    return {
      workflowId: saved.id,
      name: saved.name,
      isActive: saved.isActive,
      keywords: this.extractKeywords(saved.triggerConfig),
      replyText: this.extractReplyText(saved.stepsConfig),
    };
  }

  private findKeywordWorkflow(tenantId: string) {
    return this.prisma.workflowDefinition.findFirst({
      where: {
        tenantId,
        type: {
          in: ['keyword', 'ai_reply'],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        triggerConfig: true,
        stepsConfig: true,
      },
    });
  }

  private extractKeywords(value: unknown) {
    const config = this.toObject(value);
    const keywords = config.keywords;
    if (!Array.isArray(keywords)) {
      return [] as string[];
    }

    return this.normalizeKeywords(keywords.filter((item): item is string => typeof item === 'string'));
  }

  private extractReplyText(value: unknown) {
    const config = this.toObject(value);
    return typeof config.replyText === 'string' ? config.replyText : '';
  }

  private normalizeKeywords(keywords: string[]) {
    return Array.from(
      new Set(
        keywords
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
