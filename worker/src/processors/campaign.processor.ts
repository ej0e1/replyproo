import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../modules/queue/queue.constants';

@Injectable()
@Processor(QUEUES.CAMPAIGN_NUMBER_DISPATCH, { concurrency: 5 })
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.CAMPAIGN_DISPATCH_NUMBER) {
      return;
    }

    this.logger.log(`Campaign dispatch diproses: ${job.id}`);
  }
}
