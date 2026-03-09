import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../modules/queue/queue.constants';

@Injectable()
@Processor(QUEUES.AI_REPLY, { concurrency: 10 })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.AI_GENERATE_REPLY) {
      return;
    }

    this.logger.log(`AI reply job diproses: ${job.id}`);
  }
}
