'use client';

import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import {
  applicantStages,
  createApplicantSchema,
  createStaffTrainingSchema,
  PERMISSIONS,
  updateApplicantSchema,
  updateStaffTrainingSchema,
} from '@eims/shared';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { OpsRecordsPanel } from '@/components/features/ops/ops-records-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'applicants', label: 'Recruitment' },
  { id: 'training', label: 'Training' },
  { id: 'turnover', label: 'Turnover' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const enumOptions = (values?: readonly string[]) =>
  (values ?? []).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function HrOpsPage() {
  const [tab, setTab] = useState<TabId>('applicants');
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={UserCog}
        title="HR operations"
        description="Recruitment pipeline, teacher training, and contract join/leave history"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as TabId)}
          aria-label="HR operations sections"
          accent="purple"
        />
        {(canSelect || isLocked) && <PageBranchScopeControl />}
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch to manage HR operations records.
        </p>
      ) : tab === 'applicants' ? (
        <OpsRecordsPanel
          title="Applicants"
          path="/hr/applicants"
          queryKeyPrefix="hr-applicants"
          branchId={branchId}
          managePermission={PERMISSIONS.HR_MANAGE}
          createSchema={createApplicantSchema}
          updateSchema={updateApplicantSchema}
          createLabel="Add applicant"
          columns={[
            { key: 'appliedAt', header: 'Applied' },
            { key: 'fullName', header: 'Name' },
            { key: 'roleApplied', header: 'Role' },
            { key: 'stage', header: 'Stage', badge: true },
            { key: 'hiredUser', header: 'Hired user', nested: 'hiredUser.fullName' },
          ]}
          fields={[
            { name: 'fullName', label: 'Full name', type: 'text', required: true },
            { name: 'roleApplied', label: 'Role applied', type: 'text', required: true },
            { name: 'appliedAt', label: 'Applied date', type: 'date', required: true },
            {
              name: 'stage',
              label: 'Stage',
              type: 'select',
              options: enumOptions(applicantStages),
            },
            { name: 'email', label: 'Email', type: 'text' },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'hiredUserId', label: 'Hired user', type: 'user' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'training' ? (
        <OpsRecordsPanel
          title="Teacher training and PD"
          path="/hr/trainings"
          queryKeyPrefix="hr-trainings"
          branchId={branchId}
          managePermission={PERMISSIONS.HR_MANAGE}
          createSchema={createStaffTrainingSchema}
          updateSchema={updateStaffTrainingSchema}
          createLabel="Add training"
          columns={[
            { key: 'trainedAt', header: 'Date' },
            { key: 'user', header: 'Staff', nested: 'user.fullName' },
            { key: 'title', header: 'Title' },
            { key: 'hours', header: 'Hours' },
          ]}
          fields={[
            { name: 'userId', label: 'Staff member', type: 'user', required: true },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'trainedAt', label: 'Date', type: 'date', required: true },
            { name: 'hours', label: 'Hours', type: 'number', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : (
        <OpsRecordsPanel
          title="Employment contracts"
          path="/hr/contracts"
          queryKeyPrefix="hr-turnover"
          branchId={branchId}
          managePermission={PERMISSIONS.HR_MANAGE}
          createSchema={createApplicantSchema}
          allowEdit={false}
          hideCreate
          columns={[
            { key: 'user', header: 'Staff', nested: 'user.fullName' },
            { key: 'employmentType', header: 'Type' },
            { key: 'startDate', header: 'Start' },
            { key: 'endDate', header: 'End' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[]}
        />
      )}
    </div>
  );
}
