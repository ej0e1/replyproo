import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../modules/queue/queue.constants';

@Injectable()
@Processor(QUEUES.WORKFLOW_EXECUTE, { concurrency: 30 })
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.WORKFLOW_RUN) {
      return;
    }

    this.logger.log(`Workflow job diproses: ${job.id}`);
  }
}
