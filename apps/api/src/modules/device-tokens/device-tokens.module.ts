import { Module } from '@nestjs/common';
import { DeviceTokensController } from './device-tokens.controller';
import { DeviceTokensService } from './device-tokens.service';
import { PushService } from './push.service';

@Module({
  controllers: [DeviceTokensController],
  providers: [DeviceTokensService, PushService],
  exports: [DeviceTokensService, PushService],
})
export class DeviceTokensModule {}
