import { Module } from '@nestjs/common';
import { AiAttendanceController } from './ai-attendance.controller';
import { AiAttendanceService } from './ai-attendance.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AttendanceModule, AuditModule],
  controllers: [AiAttendanceController],
  providers: [AiAttendanceService],
})
export class AiAttendanceModule {}
