'use client';

import { useState } from 'react';
import { Bus } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { VehiclesPanel } from '@/components/features/transport/vehicles-panel';
import { RoutesPanel } from '@/components/features/transport/routes-panel';
import { StudentsPanel } from '@/components/features/transport/students-panel';
import { TripsPanel } from '@/components/features/transport/trips-panel';
import { GpsPanel } from '@/components/features/transport/gps-panel';

const TABS = [
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'routes', label: 'Routes' },
  { id: 'students', label: 'Students' },
  { id: 'trips', label: 'Trips' },
  { id: 'gps', label: 'GPS' },
] as const;

type TransportTab = (typeof TABS)[number]['id'];

export default function TransportPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<TransportTab>('vehicles');
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
        icon={Bus}
        title="Transport"
        description="Manage vehicles, routes, student assignments, trips, and GPS tracking"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as TransportTab)}
          aria-label="Transport sections"
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
      ) : tab === 'vehicles' ? (
        <VehiclesPanel branchId={effectiveBranchId} />
      ) : tab === 'routes' ? (
        <RoutesPanel branchId={effectiveBranchId} />
      ) : tab === 'students' ? (
        <StudentsPanel branchId={effectiveBranchId} />
      ) : tab === 'trips' ? (
        <TripsPanel branchId={effectiveBranchId} />
      ) : (
        <GpsPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
