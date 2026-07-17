import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { AuditModule } from '../audit/audit.module';
import { ReportsModule } from '../reports/reports.module';
import { SmsModule } from '../../common/sms/sms.module';

@Module({
  imports: [AuditModule, ReportsModule, SmsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
