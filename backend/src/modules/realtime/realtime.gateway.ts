import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/socket.io/',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('tenant:subscribe')
  handleTenantSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tenantId?: string },
  ) {
    if (!body?.tenantId) {
      return { ok: false };
    }

    client.join(this.room(body.tenantId));
    return { ok: true, tenantId: body.tenantId };
  }

  emitTenantEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(this.room(tenantId)).emit(event, payload);
  }

  private room(tenantId: string) {
    return `tenant:${tenantId}`;
  }
}
