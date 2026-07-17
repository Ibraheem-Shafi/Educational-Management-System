import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { AuditModule } from '../audit/audit.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AuditModule, AccountingModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
