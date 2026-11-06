import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImportApplyService } from './import-apply.service';
import { ImportParseService } from './import-parse.service';
import { ImportPrismaService } from './import-prisma.service';
import { ImportWorkerService } from './import-worker.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuditModule],
  controllers: [ImportsController],
  providers: [
    ImportPrismaService,
    ImportsService,
    ImportParseService,
    ImportApplyService,
    ImportWorkerService,
  ],
  exports: [ImportsService],
})
export class ImportsModule {}
