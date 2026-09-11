import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { AuditModule } from '../audit/audit.module';
import { AcademicOpsModule } from '../academic-ops/academic-ops.module';

@Module({
  imports: [AuditModule, AcademicOpsModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
