import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [AuthModule, EvolutionModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
