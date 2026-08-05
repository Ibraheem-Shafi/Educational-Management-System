import { Module } from '@nestjs/common';
import { PrintTemplatesController } from './print-templates.controller';
import { PrintTemplatesService } from './print-templates.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PrintTemplatesController],
  providers: [PrintTemplatesService],
  exports: [PrintTemplatesService],
})
export class PrintTemplatesModule {}
