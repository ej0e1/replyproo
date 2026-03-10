import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationsService } from './automations.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('manage/automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get('keyword-reply')
  async getKeywordReply(@Req() req: AuthenticatedRequest) {
    return this.automationsService.getKeywordReplySettings(this.requireTenant(req.user));
  }

  @Get('keyword-rules')
  async getKeywordRules(@Req() req: AuthenticatedRequest) {
    return this.automationsService.getKeywordRules(this.requireTenant(req.user));
  }

  @Put('keyword-reply')
  async updateKeywordReply(
    @Req() req: AuthenticatedRequest,
    @Body() body: { isActive?: boolean; keywords?: string[]; replyText?: string; name?: string },
  ) {
    return this.automationsService.saveKeywordReplySettings(this.requireTenant(req.user), body);
  }

  @Put('keyword-rules')
  async updateKeywordRules(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      rules?: Array<{ id?: string | null; isActive?: boolean; keywords?: string[]; replyText?: string; name?: string }>;
    },
  ) {
    return this.automationsService.replaceKeywordRules(this.requireTenant(req.user), body);
  }

  private requireTenant(user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new Error('Tenant aktif tidak dijumpai');
    }

    return user.activeTenantId;
  }
}
