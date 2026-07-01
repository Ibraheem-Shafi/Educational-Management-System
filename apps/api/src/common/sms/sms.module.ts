import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';

@Global()
@Module({
  providers: [SmsService, WhatsAppService],
  exports: [SmsService, WhatsAppService],
})
export class SmsModule {}
