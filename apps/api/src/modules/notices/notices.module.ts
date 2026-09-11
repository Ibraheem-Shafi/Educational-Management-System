import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [AuditModule, CommunicationsModule],
  controllers: [NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
