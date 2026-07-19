import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [AuditModule, CommunicationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
