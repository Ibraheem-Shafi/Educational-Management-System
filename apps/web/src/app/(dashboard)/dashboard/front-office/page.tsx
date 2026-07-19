'use client';

import { useState } from 'react';
import { Headset } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { InquiriesPanel } from '@/components/features/front-office/inquiries-panel';
import { VisitorsPanel } from '@/components/features/front-office/visitors-panel';
import { ComplaintsPanel } from '@/components/features/front-office/complaints-panel';
import { ActivityPanel } from '@/components/features/front-office/activity-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'activity', label: 'Activity' },
] as const;

type FrontOfficeTab = (typeof TABS)[number]['id'];

export default function FrontOfficePage() {
  const [tab, setTab] = useState<FrontOfficeTab>('inquiries');
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);

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
        {(canSelect || isLocked) && <PageBranchScopeControl />}
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (use the page override or app selector) to manage front-office
          records. Create and edit actions require exactly one branch.
        </p>
      ) : tab === 'inquiries' ? (
        <InquiriesPanel branchId={branchId} />
      ) : tab === 'visitors' ? (
        <VisitorsPanel branchId={branchId} />
      ) : tab === 'complaints' ? (
        <ComplaintsPanel branchId={branchId} />
      ) : (
        <ActivityPanel branchId={branchId} />
      )}
    </div>
  );
}
