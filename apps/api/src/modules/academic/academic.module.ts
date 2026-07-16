import { Module } from '@nestjs/common';
import {
  ProgramsController,
  BatchesController,
  SubjectsController,
  AcademicSessionsController,
} from './academic.controller';
import { AcademicStatsController } from './academic-stats.controller';
import {
  ProgramsService,
  BatchesService,
  SubjectsService,
  AcademicSessionsService,
  BatchSubjectsService,
} from './academic.service';
import { AcademicStatsService } from './academic-stats.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [
    AcademicStatsController,
    ProgramsController,
    BatchesController,
    SubjectsController,
    AcademicSessionsController,
  ],
  providers: [
    AcademicStatsService,
    ProgramsService,
    BatchesService,
    SubjectsService,
    AcademicSessionsService,
    BatchSubjectsService,
  ],
})
export class AcademicModule {}
