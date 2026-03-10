import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type KeywordRule = {
  id: string | null;
  name: string;
  isActive: boolean;
  keywords: string[];
  replyText: string;
};

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKeywordRules(tenantId: string): Promise<{ rules: KeywordRule[] }> {
    const workflows = await this.findKeywordWorkflows(tenantId);

    return {
      rules: workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        isActive: workflow.isActive,
        keywords: this.extractKeywords(workflow.triggerConfig),
        replyText: this.extractReplyText(workflow.stepsConfig),
      })),
    };
  }

  async replaceKeywordRules(
    tenantId: string,
    body: { rules?: Array<{ id?: string | null; isActive?: boolean; keywords?: string[]; replyText?: string; name?: string }> },
  ): Promise<{ rules: KeywordRule[] }> {
    const incomingRules = Array.isArray(body.rules) ? body.rules : [];

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workflowDefinition.findMany({
        where: {
          tenantId,
          type: {
            in: ['keyword', 'ai_reply'],
          },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      const keepIds = new Set<string>();

      for (const rule of incomingRules) {
        const normalizedKeywords = this.normalizeKeywords(rule.keywords ?? []);
        const replyText = typeof rule.replyText === 'string' ? rule.replyText.trim() : '';
        const name = typeof rule.name === 'string' && rule.name.trim() ? rule.name.trim() : 'Keyword Auto Reply';

        if (!normalizedKeywords.length || !replyText) {
          continue;
        }

        const data = {
          name,
          type: 'keyword' as const,
          isActive: Boolean(rule.isActive),
          triggerConfig: {
            keywords: normalizedKeywords,
          },
          stepsConfig: {
            replyText,
            fallbackToHuman: true,
          },
        };

        if (rule.id && existing.some((item) => item.id === rule.id)) {
          await tx.workflowDefinition.update({
            where: { id: rule.id },
            data,
          });
          keepIds.add(rule.id);
          continue;
        }

        const created = await tx.workflowDefinition.create({
          data: {
            tenantId,
            ...data,
          },
          select: { id: true },
        });
        keepIds.add(created.id);
      }

      const deleteIds = existing.map((item) => item.id).filter((id) => !keepIds.has(id));
      if (deleteIds.length) {
        await tx.workflowDefinition.deleteMany({
          where: {
            tenantId,
            id: { in: deleteIds },
          },
        });
      }
    });

    return this.getKeywordRules(tenantId);
  }

  async getKeywordReplySettings(tenantId: string) {
    const settings = await this.getKeywordRules(tenantId);
    const firstRule = settings.rules[0] ?? null;

    return {
      workflowId: firstRule?.id ?? null,
      name: firstRule?.name ?? 'Keyword Auto Reply',
      isActive: firstRule?.isActive ?? false,
      keywords: firstRule?.keywords ?? [],
      replyText: firstRule?.replyText ?? '',
    };
  }

  async saveKeywordReplySettings(
    tenantId: string,
    body: { isActive?: boolean; keywords?: string[]; replyText?: string; name?: string },
  ) {
    const result = await this.replaceKeywordRules(tenantId, {
      rules: [
        {
          isActive: body.isActive,
          keywords: body.keywords,
          replyText: body.replyText,
          name: body.name,
        },
      ],
    });

    const firstRule = result.rules[0] ?? null;
    return {
      workflowId: firstRule?.id ?? null,
      name: firstRule?.name ?? 'Keyword Auto Reply',
      isActive: firstRule?.isActive ?? false,
      keywords: firstRule?.keywords ?? [],
      replyText: firstRule?.replyText ?? '',
    };
  }

  private findKeywordWorkflows(tenantId: string) {
    return this.prisma.workflowDefinition.findMany({
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
    return Array.from(new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)));
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
