import { Module } from '@nestjs/common';
import { AuthController, PortalController } from './auth.controller';
import { AuthService, PortalService } from './auth.service';
import { AuditModule } from '../audit/audit.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { FeesModule } from '../fees/fees.module';

import { NoticesModule } from '../notices/notices.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, AttendanceModule, AssessmentsModule, FeesModule, NoticesModule, SettingsModule],
  controllers: [AuthController, PortalController],
  providers: [AuthService, PortalService],
})
export class AuthModule {}
