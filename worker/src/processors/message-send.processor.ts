import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../modules/queue/queue.constants';
import { OutboundDispatcherService } from '../services/outbound-dispatcher.service';

@Injectable()
@Processor(QUEUES.MESSAGE_SEND, { concurrency: 20 })
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly outboundDispatcherService: OutboundDispatcherService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    if (job.name !== JOBS.MESSAGE_SEND_SINGLE) {
      return;
    }

    const { messageId, channelId, instanceName, to, content } = job.data;
    const targetInstance = instanceName ?? channelId;

    await this.outboundDispatcherService.updateMessageStatus(messageId, {
      status: 'processing',
    });

    const ensure = await this.outboundDispatcherService.ensureInstance(targetInstance);
    if (!ensure.ready) {
      await this.outboundDispatcherService.updateMessageStatus(messageId, {
        status: 'failed',
        errorMessage: `Instance ${targetInstance} tidak berjaya diprovision`,
      });
      throw new Error(`Instance ${targetInstance} tidak berjaya diprovision`);
    }

    try {
      const result = await this.outboundDispatcherService.sendViaEvolution({
        channelId: targetInstance,
        to,
        content,
      });

      await this.outboundDispatcherService.updateMessageStatus(messageId, {
        status: 'sent',
        providerMessageId: result.providerMessageId,
      });

      this.logger.log(`Message dihantar: ${job.id} -> ${result.providerMessageId}`);
    } catch (error) {
      await this.outboundDispatcherService.updateMessageStatus(messageId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Send gagal',
      });
      throw error;
    }
  }
}
