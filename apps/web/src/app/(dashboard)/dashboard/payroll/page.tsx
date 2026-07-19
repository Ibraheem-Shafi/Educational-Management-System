'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { StructuresPanel } from '@/components/features/payroll/structures-panel';
import { RunsPanel } from '@/components/features/payroll/runs-panel';
import { HistoryPanel } from '@/components/features/payroll/history-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'structures', label: 'Structures' },
  { id: 'runs', label: 'Runs' },
  { id: 'history', label: 'History' },
] as const;

type PayrollTab = (typeof TABS)[number]['id'];

export default function PayrollPage() {
  const searchParams = useSearchParams();
  const userIdFilter = searchParams.get('userId') ?? undefined;
  const initialTab = (searchParams.get('runId')
    ? 'runs'
    : userIdFilter
      ? 'structures'
      : 'structures') as PayrollTab;

  const [tab, setTab] = useState<PayrollTab>(initialTab);
  const { singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Banknote}
        title="Payroll"
        description="Salary structures, monthly runs, and payment history"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as PayrollTab)}
          aria-label="Payroll sections"
        />
        <PageBranchScopeControl />
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to manage payroll.
        </p>
      ) : tab === 'structures' ? (
        <StructuresPanel branchId={branchId} userId={userIdFilter} />
      ) : tab === 'runs' ? (
        <RunsPanel branchId={branchId} />
      ) : (
        <HistoryPanel branchId={branchId} />
      )}
    </div>
  );
}
