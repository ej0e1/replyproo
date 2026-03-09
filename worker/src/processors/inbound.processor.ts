import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../modules/queue/queue.constants';

@Injectable()
@Processor(QUEUES.INBOUND_PROCESS, { concurrency: 50 })
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.INBOUND_RECEIVED) {
      return;
    }

    this.logger.log(`Inbound job diterima: ${job.id}`);
  }
}
