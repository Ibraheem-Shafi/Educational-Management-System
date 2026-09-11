import { Module } from '@nestjs/common';
import { AcademicOpsController } from './academic-ops.controller';
import { AcademicOpsService } from './academic-ops.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AcademicOpsController],
  providers: [AcademicOpsService],
  exports: [AcademicOpsService],
})
export class AcademicOpsModule {}
