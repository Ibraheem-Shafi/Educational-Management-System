'use client';

import { useState } from 'react';
import { Library } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { CatalogPanel } from '@/components/features/library/catalog-panel';
import { LoansPanel } from '@/components/features/library/loans-panel';
import { ReservationsPanel } from '@/components/features/library/reservations-panel';
import { FinesPanel } from '@/components/features/library/fines-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'loans', label: 'Loans' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'fines', label: 'Fines' },
] as const;

type LibraryTab = (typeof TABS)[number]['id'];

export default function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>('catalog');
  const { singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Library}
        title="Library"
        description="Manage catalog, loans, reservations, and overdue fines"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as LibraryTab)}
          aria-label="Library sections"
        />
        <PageBranchScopeControl />
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to manage library records.
        </p>
      ) : tab === 'catalog' ? (
        <CatalogPanel branchId={branchId} />
      ) : tab === 'loans' ? (
        <LoansPanel branchId={branchId} />
      ) : tab === 'reservations' ? (
        <ReservationsPanel branchId={branchId} />
      ) : (
        <FinesPanel branchId={branchId} />
      )}
    </div>
  );
}
