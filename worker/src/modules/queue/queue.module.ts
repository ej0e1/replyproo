import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'redis'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        prefix: config.get<string>('BULLMQ_PREFIX', 'replypro'),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.INBOUND_PROCESS },
      { name: QUEUES.WORKFLOW_EXECUTE },
      { name: QUEUES.AI_REPLY },
      { name: QUEUES.MESSAGE_SEND },
      { name: QUEUES.CAMPAIGN_SCHEDULE },
      { name: QUEUES.CAMPAIGN_NUMBER_DISPATCH },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
