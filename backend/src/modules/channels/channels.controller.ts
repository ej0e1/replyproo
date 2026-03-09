import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChannelsService } from './channels.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard)
@Controller('manage/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async listChannels(@Req() req: AuthenticatedRequest) {
    return this.channelsService.listChannels(this.requireTenant(req.user));
  }

  @Post(':channelId/connect')
  async connectChannel(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.connectChannel(this.requireTenant(req.user), channelId);
  }

  @Post(':channelId/refresh')
  async refreshChannel(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.refreshChannelStatus(this.requireTenant(req.user), channelId);
  }

  private requireTenant(user: AuthenticatedUser) {
    if (!user.activeTenantId) {
      throw new Error('Tenant aktif tidak dijumpai');
    }

    return user.activeTenantId;
  }
}
