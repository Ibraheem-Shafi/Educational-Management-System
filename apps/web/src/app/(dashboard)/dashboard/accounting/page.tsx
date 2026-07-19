'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { AccountsPanel } from '@/components/features/accounting/accounts-panel';
import { VouchersPanel } from '@/components/features/accounting/vouchers-panel';
import { ReportsPanel } from '@/components/features/accounting/reports-panel';
import { BudgetsPanel } from '@/components/features/accounting/budgets-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'accounts', label: 'Chart of accounts' },
  { id: 'vouchers', label: 'Vouchers' },
  { id: 'reports', label: 'Reports' },
  { id: 'budgets', label: 'Budgets' },
] as const;

type AccountingTab = (typeof TABS)[number]['id'];

export default function AccountingPage() {
  const [tab, setTab] = useState<AccountingTab>('accounts');
  const { singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';

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
        <PageBranchScopeControl />
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to manage accounting records.
        </p>
      ) : tab === 'accounts' ? (
        <AccountsPanel branchId={branchId} />
      ) : tab === 'vouchers' ? (
        <VouchersPanel branchId={branchId} />
      ) : tab === 'reports' ? (
        <ReportsPanel branchId={branchId} />
      ) : (
        <BudgetsPanel branchId={branchId} />
      )}
    </div>
  );
}
