import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SendMessageDto } from './dto/send-message.dto';
import { InboxService } from './inbox.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller()
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('contacts')
  async listContacts(@Req() req: AuthenticatedRequest) {
    return this.inboxService.listContacts(this.requireTenant(req.user));
  }

  @Get('conversations')
  async listConversations(@Req() req: AuthenticatedRequest) {
    return this.inboxService.listConversations(this.requireTenant(req.user));
  }

  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inboxService.getConversationMessages(
      this.requireTenant(req.user),
      conversationId,
    );
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.inboxService.sendMessage(
      this.requireTenant(req.user),
      conversationId,
      body.content,
    );
  }

  @Patch('conversations/:conversationId/status')
  async updateConversationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: { status: 'open' | 'pending' | 'resolved' | 'closed' },
  ) {
    return this.inboxService.updateConversationStatus(
      this.requireTenant(req.user),
      req.user.sub,
      conversationId,
      body.status,
    );
  }

  @Patch('conversations/:conversationId/assignee')
  async updateConversationAssignee(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: { action: 'assign_to_me' | 'unassign' },
  ) {
    return this.inboxService.updateConversationAssignee(
      this.requireTenant(req.user),
      req.user.sub,
      conversationId,
      body.action,
    );
  }

  @Patch('conversations/:conversationId/lead-stage')
  async updateLeadStage(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      stage:
        | 'new_lead'
        | 'follow_up'
        | 'test_drive'
        | 'booking'
        | 'loan_submitted'
        | 'won'
        | 'lost';
    },
  ) {
    return this.inboxService.updateLeadStage(
      this.requireTenant(req.user),
      req.user.sub,
      conversationId,
      body.stage,
    );
  }

  private requireTenant(user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new Error('Tenant aktif tidak dijumpai');
    }

    return user.activeTenantId;
  }
}
