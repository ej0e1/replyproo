import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { EvolutionModule } from './modules/evolution/evolution.module';
import { HealthController } from './modules/health/health.controller';
import { InboxModule } from './modules/inbox/inbox.module';
import { InternalModule } from './modules/internal/internal.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { QueueModule } from './modules/queue/queue.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WhatsAppController } from './modules/whatsapp/whatsapp.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RealtimeModule,
    AuthModule,
    ChannelsModule,
    QueueModule,
    EvolutionModule,
    InboxModule,
    InternalModule,
    TenantsModule,
  ],
  controllers: [HealthController, WhatsAppController],
})
export class AppModule {}
