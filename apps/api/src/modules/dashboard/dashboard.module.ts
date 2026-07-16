import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StudentsModule } from '../students/students.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ReportsModule, AnalyticsModule, StudentsModule, PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
