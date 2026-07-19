import { Module } from '@nestjs/common';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { TransportGpsWebhookGuard } from './transport-gps-webhook.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TransportController],
  providers: [TransportService, TransportGpsWebhookGuard],
  exports: [TransportService],
})
export class TransportModule {}
