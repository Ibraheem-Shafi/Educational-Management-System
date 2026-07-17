'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { AccountsPanel } from '@/components/features/accounting/accounts-panel';
import { VouchersPanel } from '@/components/features/accounting/vouchers-panel';
import { ReportsPanel } from '@/components/features/accounting/reports-panel';
import { BudgetsPanel } from '@/components/features/accounting/budgets-panel';

const TABS = [
  { id: 'accounts', label: 'Chart of accounts' },
  { id: 'vouchers', label: 'Vouchers' },
  { id: 'reports', label: 'Reports' },
  { id: 'budgets', label: 'Budgets' },
] as const;

type AccountingTab = (typeof TABS)[number]['id'];

export default function AccountingPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<AccountingTab>('accounts');
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
        icon={Calculator}
        title="Accounting"
        description="Chart of accounts, journal vouchers, financial reports, and budgets"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as AccountingTab)}
          aria-label="Accounting sections"
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
      ) : tab === 'accounts' ? (
        <AccountsPanel branchId={effectiveBranchId} />
      ) : tab === 'vouchers' ? (
        <VouchersPanel branchId={effectiveBranchId} />
      ) : tab === 'reports' ? (
        <ReportsPanel branchId={effectiveBranchId} />
      ) : (
        <BudgetsPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
