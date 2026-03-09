import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOBS, QUEUES } from './queue.constants';

type InboundPayload = {
  tenantId: string;
  channelId: string;
  messageId: string;
  rawEvent: unknown;
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUES.INBOUND_PROCESS) private readonly inboundQueue: Queue,
    @InjectQueue(QUEUES.WORKFLOW_EXECUTE) private readonly workflowQueue: Queue,
    @InjectQueue(QUEUES.AI_REPLY) private readonly aiQueue: Queue,
    @InjectQueue(QUEUES.MESSAGE_SEND) private readonly messageSendQueue: Queue,
    @InjectQueue(QUEUES.CAMPAIGN_SCHEDULE) private readonly campaignQueue: Queue,
    @InjectQueue(QUEUES.CAMPAIGN_NUMBER_DISPATCH)
    private readonly campaignNumberQueue: Queue,
  ) {}

  enqueueInboundMessage(data: InboundPayload) {
    return this.inboundQueue.add(JOBS.INBOUND_RECEIVED, data, { priority: 1 });
  }

  enqueueWorkflow(data: Record<string, unknown>) {
    return this.workflowQueue.add(JOBS.WORKFLOW_RUN, data, { priority: 2 });
  }

  enqueueAiReply(data: Record<string, unknown>) {
    return this.aiQueue.add(JOBS.AI_GENERATE_REPLY, data, { priority: 3 });
  }

  enqueueMessageSend(data: {
    tenantId: string;
    channelId: string;
    conversationId: string;
    messageId: string;
    to: string;
    content: string;
    instanceName?: string;
    delayMs?: number;
  }) {
    return this.messageSendQueue.add(JOBS.MESSAGE_SEND_SINGLE, data, {
      delay: data.delayMs ?? 0,
      priority: 1,
      jobId: `send-${data.messageId}`,
    });
  }

  enqueueCampaignSchedule(data: Record<string, unknown>) {
    return this.campaignQueue.add(JOBS.CAMPAIGN_PREPARE, data, { priority: 10 });
  }

  enqueueCampaignNumberDispatch(data: {
    campaignId: string;
    tenantId: string;
    channelId: string;
    recipients: Array<{ contactId: string; phone: string; name?: string }>;
  }) {
    return this.campaignNumberQueue.add(JOBS.CAMPAIGN_DISPATCH_NUMBER, data, {
      priority: 20,
    });
  }
}
