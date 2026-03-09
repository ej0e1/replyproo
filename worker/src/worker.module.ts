import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './modules/queue/queue.module';
import { AiProcessor } from './processors/ai.processor';
import { CampaignProcessor } from './processors/campaign.processor';
import { InboundProcessor } from './processors/inbound.processor';
import { MessageSendProcessor } from './processors/message-send.processor';
import { WorkflowProcessor } from './processors/workflow.processor';
import { EvolutionClientService } from './services/evolution-client.service';
import { OutboundDispatcherService } from './services/outbound-dispatcher.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), QueueModule],
  providers: [
    InboundProcessor,
    WorkflowProcessor,
    AiProcessor,
    MessageSendProcessor,
    CampaignProcessor,
    EvolutionClientService,
    OutboundDispatcherService,
  ],
})
export class WorkerModule {}
