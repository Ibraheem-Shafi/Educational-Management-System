'use client';

import { useState } from 'react';
import { Library } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { CatalogPanel } from '@/components/features/library/catalog-panel';
import { LoansPanel } from '@/components/features/library/loans-panel';
import { ReservationsPanel } from '@/components/features/library/reservations-panel';
import { FinesPanel } from '@/components/features/library/fines-panel';

const TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'loans', label: 'Loans' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'fines', label: 'Fines' },
] as const;

type LibraryTab = (typeof TABS)[number]['id'];

export default function LibraryPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<LibraryTab>('catalog');
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
      ) : tab === 'catalog' ? (
        <CatalogPanel branchId={effectiveBranchId} />
      ) : tab === 'loans' ? (
        <LoansPanel branchId={effectiveBranchId} />
      ) : tab === 'reservations' ? (
        <ReservationsPanel branchId={effectiveBranchId} />
      ) : (
        <FinesPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
