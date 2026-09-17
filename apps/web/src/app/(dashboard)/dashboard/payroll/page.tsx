'use client';

import { Banknote } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { SalarySheetPanel } from '@/components/features/payroll/salary-sheet-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

export default function PayrollPage() {
  const { singleBranchId, branches } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';
  const branchName = branches.find((branch) => branch.id === branchId)?.name;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Banknote}
        title="Payroll"
        description="Campus monthly salary sheet — edit, save, and mark paid"
        actions={<PageBranchScopeControl />}
      />

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single campus to open its salary sheet.
        </p>
      ) : (
        <SalarySheetPanel branchId={branchId} branchName={branchName} />
      )}
    </div>
  );
}
