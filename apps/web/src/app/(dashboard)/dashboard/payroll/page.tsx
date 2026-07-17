'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { StructuresPanel } from '@/components/features/payroll/structures-panel';
import { RunsPanel } from '@/components/features/payroll/runs-panel';
import { HistoryPanel } from '@/components/features/payroll/history-panel';

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

  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<PayrollTab>(initialTab);
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

  const { effectiveBranchId, branches, branchesLoading } = useEffectiveBranchId(
    token,
    user?.branchId,
    branchId,
  );

  if (branchesLoading && !effectiveBranchId) {
    return <PortalPageSkeleton />;
  }

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

        {!user?.branchId && (branches?.data.length ?? 0) > 1 ? (
          <SelectDropdown
            aria-label="Branch"
            placeholder="Select branch"
            value={branchId || effectiveBranchId}
            onValueChange={setBranchId}
            options={(branches?.data ?? []).map((b) => ({
              value: b.id,
              label: b.name,
            }))}
            className="w-full sm:w-[220px]"
          />
        ) : null}
      </div>

      {!effectiveBranchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">Select a branch to continue.</p>
      ) : tab === 'structures' ? (
        <StructuresPanel branchId={effectiveBranchId} userId={userIdFilter} />
      ) : tab === 'runs' ? (
        <RunsPanel branchId={effectiveBranchId} />
      ) : (
        <HistoryPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
