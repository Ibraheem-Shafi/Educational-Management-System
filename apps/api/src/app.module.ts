import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { GuardsModule } from './common/guards/guards.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { StudentsModule } from './modules/students/students.module';
import { AuditModule } from './modules/audit/audit.module';
import { AcademicModule } from './modules/academic/academic.module';
import { UsersModule } from './modules/users/users.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { FeesModule } from './modules/fees/fees.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ParentsModule } from './modules/parents/parents.module';
import { NoticesModule } from './modules/notices/notices.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { FormFieldsModule } from './modules/form-fields/form-fields.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AiAttendanceModule } from './modules/ai-attendance/ai-attendance.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';
import { LearningModule } from './modules/learning/learning.module';
import { FrontOfficeModule } from './modules/front-office/front-office.module';
import { HrModule } from './modules/hr/hr.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { LibraryModule } from './modules/library/library.module';
import { TransportModule } from './modules/transport/transport.module';
import { BiometricModule } from './modules/biometric/biometric.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { SmsModule } from './common/sms/sms.module';
import { EmailModule } from './common/email/email.module';
import { DeviceTokensModule } from './modules/device-tokens/device-tokens.module';
import { PrintTemplatesModule } from './modules/print-templates/print-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    GuardsModule,
    EmailModule,
    SmsModule,
    PrismaModule,
    AuditModule,
    HealthModule,
    SettingsModule,
    AuthModule,
    BranchesModule,
    StudentsModule,
    AcademicModule,
    UsersModule,
    AttendanceModule,
    AssessmentsModule,
    AccountingModule,
    FeesModule,
    PaymentsModule,
    ParentsModule,
    NoticesModule,
    ReportsModule,
    DashboardModule,
    TimetableModule,
    FormFieldsModule,
    AnalyticsModule,
    DocumentsModule,
    AiAttendanceModule,
    CommunicationsModule,
    AiInsightsModule,
    LearningModule,
    FrontOfficeModule,
    HrModule,
    CertificatesModule,
    LibraryModule,
    TransportModule,
    BiometricModule,
    PayrollModule,
    DeviceTokensModule,
    PrintTemplatesModule,
  ],
})
export class AppModule {}
