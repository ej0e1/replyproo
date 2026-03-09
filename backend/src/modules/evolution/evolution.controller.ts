import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EvolutionService } from './evolution.service';

@Controller('channels')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}

  @Post(':instanceName/connect')
  async connectChannel(@Param('instanceName') instanceName: string) {
    await this.evolutionService.createInstance(instanceName);
    return this.evolutionService.getQrCode(instanceName);
  }

  @Get(':instanceName/qr')
  async getQrCode(@Param('instanceName') instanceName: string) {
    return this.evolutionService.getQrCode(instanceName);
  }

  @Get(':instanceName/status')
  async getStatus(@Param('instanceName') instanceName: string) {
    return this.evolutionService.fetchInstance(instanceName);
  }

  @Post(':instanceName/send')
  async sendMessage(
    @Param('instanceName') instanceName: string,
    @Body() body: { number: string; text: string },
  ) {
    return this.evolutionService.sendTextMessage({
      instanceName,
      number: body.number,
      text: body.text,
    });
  }
}
