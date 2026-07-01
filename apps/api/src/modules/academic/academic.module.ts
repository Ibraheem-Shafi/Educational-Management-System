import { Module } from '@nestjs/common';
import {
  ProgramsController,
  BatchesController,
  SubjectsController,
  AcademicSessionsController,
} from './academic.controller';
import {
  ProgramsService,
  BatchesService,
  SubjectsService,
  AcademicSessionsService,
  BatchSubjectsService,
} from './academic.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [
    ProgramsController,
    BatchesController,
    SubjectsController,
    AcademicSessionsController,
  ],
  providers: [
    ProgramsService,
    BatchesService,
    SubjectsService,
    AcademicSessionsService,
    BatchSubjectsService,
  ],
})
export class AcademicModule {}
