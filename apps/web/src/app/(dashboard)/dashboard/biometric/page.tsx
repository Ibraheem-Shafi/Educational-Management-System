'use client';

import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { DevicesPanel } from '@/components/features/biometric/devices-panel';
import { MappingsPanel } from '@/components/features/biometric/mappings-panel';
import { PunchLogPanel } from '@/components/features/biometric/punch-log-panel';
import { IntegrationPanel } from '@/components/features/biometric/integration-panel';

const TABS = [
  { id: 'devices', label: 'Devices' },
  { id: 'mappings', label: 'ID mappings' },
  { id: 'punch-log', label: 'Punch log' },
  { id: 'integration', label: 'Integration' },
] as const;

type BiometricTab = (typeof TABS)[number]['id'];

export default function BiometricPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<BiometricTab>('devices');
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
        icon={Fingerprint}
        title="Biometric"
        description="Manage biometric devices, ID mappings, punch logs, and webhook integration"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as BiometricTab)}
          aria-label="Biometric sections"
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
      ) : tab === 'devices' ? (
        <DevicesPanel branchId={effectiveBranchId} />
      ) : tab === 'mappings' ? (
        <MappingsPanel branchId={effectiveBranchId} />
      ) : tab === 'punch-log' ? (
        <PunchLogPanel branchId={effectiveBranchId} />
      ) : (
        <IntegrationPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
