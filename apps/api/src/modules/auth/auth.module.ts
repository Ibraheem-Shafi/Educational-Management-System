import { Module } from '@nestjs/common';
import { AuthController, PortalController } from './auth.controller';
import { LeaveRequestsController } from './leave-requests.controller';
import { AuthService, PortalService } from './auth.service';
import { PortalSectionsService } from './portal-sections.service';
import { PortalTeacherService } from './portal-teacher.service';
import { AuditModule } from '../audit/audit.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { FeesModule } from '../fees/fees.module';
import { NoticesModule } from '../notices/notices.module';
import { SettingsModule } from '../settings/settings.module';
import { LearningModule } from '../learning/learning.module';
import { DocumentsModule } from '../documents/documents.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';

@Module({
  imports: [
    AuditModule,
    AttendanceModule,
    AssessmentsModule,
    FeesModule,
    NoticesModule,
    SettingsModule,
    LearningModule,
    DocumentsModule,
    AiInsightsModule,
  ],
  controllers: [AuthController, PortalController, LeaveRequestsController],
  providers: [AuthService, PortalService, PortalSectionsService, PortalTeacherService],
})
export class AuthModule {}
