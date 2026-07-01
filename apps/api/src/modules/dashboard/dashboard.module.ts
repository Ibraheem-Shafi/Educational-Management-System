import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [ReportsModule, AnalyticsModule, StudentsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
