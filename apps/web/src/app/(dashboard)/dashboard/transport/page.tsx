'use client';

import { useState } from 'react';
import { Bus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { VehiclesPanel } from '@/components/features/transport/vehicles-panel';
import { RoutesPanel } from '@/components/features/transport/routes-panel';
import { StudentsPanel } from '@/components/features/transport/students-panel';
import { TripsPanel } from '@/components/features/transport/trips-panel';
import { GpsPanel } from '@/components/features/transport/gps-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'routes', label: 'Routes' },
  { id: 'students', label: 'Students' },
  { id: 'trips', label: 'Trips' },
  { id: 'gps', label: 'GPS' },
] as const;

type TransportTab = (typeof TABS)[number]['id'];

export default function TransportPage() {
  const [tab, setTab] = useState<TransportTab>('vehicles');
  const { singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';

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
        <PageBranchScopeControl />
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to manage transport records.
        </p>
      ) : tab === 'vehicles' ? (
        <VehiclesPanel branchId={branchId} />
      ) : tab === 'routes' ? (
        <RoutesPanel branchId={branchId} />
      ) : tab === 'students' ? (
        <StudentsPanel branchId={branchId} />
      ) : tab === 'trips' ? (
        <TripsPanel branchId={branchId} />
      ) : (
        <GpsPanel branchId={branchId} />
      )}
    </div>
  );
}
