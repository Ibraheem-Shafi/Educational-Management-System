'use client';

import { useState } from 'react';
import { Headset } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Tabs } from '@/components/ui/tabs';
import { InquiriesPanel } from '@/components/features/front-office/inquiries-panel';
import { VisitorsPanel } from '@/components/features/front-office/visitors-panel';
import { ComplaintsPanel } from '@/components/features/front-office/complaints-panel';
import { ActivityPanel } from '@/components/features/front-office/activity-panel';

const TABS = [
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'activity', label: 'Activity' },
] as const;

type FrontOfficeTab = (typeof TABS)[number]['id'];

export default function FrontOfficePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [tab, setTab] = useState<FrontOfficeTab>('inquiries');
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
        icon={Headset}
        title="Front office"
        description="Manage admission inquiries, visitors, complaints, and reception activity"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as FrontOfficeTab)}
          aria-label="Front office sections"
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
      ) : tab === 'inquiries' ? (
        <InquiriesPanel branchId={effectiveBranchId} />
      ) : tab === 'visitors' ? (
        <VisitorsPanel branchId={effectiveBranchId} />
      ) : tab === 'complaints' ? (
        <ComplaintsPanel branchId={effectiveBranchId} />
      ) : (
        <ActivityPanel branchId={effectiveBranchId} />
      )}
    </div>
  );
}
