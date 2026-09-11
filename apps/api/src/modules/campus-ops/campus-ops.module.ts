import { Module } from '@nestjs/common';
import { CampusOpsController } from './campus-ops.controller';
import { CampusOpsService } from './campus-ops.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CampusOpsController],
  providers: [CampusOpsService],
  exports: [CampusOpsService],
})
export class CampusOpsModule {}
