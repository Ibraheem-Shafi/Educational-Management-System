import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsAudienceService } from './audience.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TwilioWebhookGuard } from './twilio-webhook.guard';
import { AuditModule } from '../audit/audit.module';
import { SmsModule } from '../../common/sms/sms.module';

@Module({
  imports: [AuditModule, SmsModule],
  controllers: [CommunicationsController, TwilioWebhookController],
  providers: [CommunicationsService, CommunicationsAudienceService, TwilioWebhookGuard],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
