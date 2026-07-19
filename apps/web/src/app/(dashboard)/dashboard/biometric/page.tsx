'use client';

import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { DevicesPanel } from '@/components/features/biometric/devices-panel';
import { MappingsPanel } from '@/components/features/biometric/mappings-panel';
import { PunchLogPanel } from '@/components/features/biometric/punch-log-panel';
import { IntegrationPanel } from '@/components/features/biometric/integration-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'devices', label: 'Devices' },
  { id: 'mappings', label: 'ID mappings' },
  { id: 'punch-log', label: 'Punch log' },
  { id: 'integration', label: 'Integration' },
] as const;

type BiometricTab = (typeof TABS)[number]['id'];

export default function BiometricPage() {
  const [tab, setTab] = useState<BiometricTab>('devices');
  const { singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? '';

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
        <PageBranchScopeControl />
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to manage biometric devices and logs.
        </p>
      ) : tab === 'devices' ? (
        <DevicesPanel branchId={branchId} />
      ) : tab === 'mappings' ? (
        <MappingsPanel branchId={branchId} />
      ) : tab === 'punch-log' ? (
        <PunchLogPanel branchId={branchId} />
      ) : (
        <IntegrationPanel branchId={branchId} />
      )}
    </div>
  );
}
