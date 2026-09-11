import { Module } from '@nestjs/common';
import { FinanceOpsController } from './finance-ops.controller';
import { FinanceOpsService } from './finance-ops.service';
import { AuditModule } from '../audit/audit.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AuditModule, AccountingModule],
  controllers: [FinanceOpsController],
  providers: [FinanceOpsService],
  exports: [FinanceOpsService],
})
export class FinanceOpsModule {}
