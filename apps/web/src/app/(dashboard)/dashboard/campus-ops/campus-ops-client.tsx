'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import {
  complianceControlStatuses,
  createComplianceControlSchema,
  createItOutageSchema,
  createSafetyIncidentSchema,
  createWorkOrderSchema,
  PERMISSIONS,
  safetySeverities,
  updateComplianceControlSchema,
  updateItOutageSchema,
  updateSafetyIncidentSchema,
  updateWorkOrderSchema,
  workOrderStatuses,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { OpsRecordsPanel, OpsStatusSummary } from '@/components/features/ops/ops-records-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'infra', label: 'Infrastructure' },
  { id: 'safety', label: 'Safety' },
  { id: 'it', label: 'IT & ERP' },
  { id: 'compliance', label: 'Compliance' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const enumOptions = (values?: readonly string[]) =>
  (values ?? []).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function CampusOpsPage() {
  const [tab, setTab] = useState<TabId>('infra');
  const { session } = useAuth();
  const token = session?.access_token;
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);

  const { data: itStatus } = useQuery({
    queryKey: queryKeys.opsRecords('it-status', branchId ?? ''),
    queryFn: () =>
      apiClient<{
        devices: Array<{ name: string; isActive: boolean; lastSeenAt: string | null; location: string | null }>;
        lastBiometricPunch: { punchedAt: string | null; device: string } | null;
        openOutages: Array<{ system: string; summary: string; startedAt: string }>;
      }>(`/campus-ops/it-status?branchId=${branchId}`, { token }),
    enabled: !!token && !!branchId && tab === 'it',
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Building2}
        title="Campus operations"
        description="Work orders, safety incidents, IT outages, and the compliance register"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as TabId)}
          aria-label="Campus operations sections"
          accent="yellow"
        />
        {(canSelect || isLocked) && <PageBranchScopeControl />}
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch to manage campus operations records.
        </p>
      ) : tab === 'infra' ? (
        <OpsRecordsPanel
          title="Work orders"
          path="/campus-ops/work-orders"
          queryKeyPrefix="work-orders"
          branchId={branchId}
          managePermission={PERMISSIONS.SETTINGS_MANAGE}
          createSchema={createWorkOrderSchema}
          updateSchema={updateWorkOrderSchema}
          createLabel="Add work order"
          columns={[
            { key: 'reportedAt', header: 'Reported' },
            { key: 'location', header: 'Location' },
            { key: 'issue', header: 'Issue' },
            { key: 'status', header: 'Status', badge: true },
            { key: 'cost', header: 'Cost' },
          ]}
          fields={[
            { name: 'reportedAt', label: 'Reported date', type: 'date', required: true },
            { name: 'location', label: 'Location', type: 'text', required: true },
            { name: 'issue', label: 'Issue', type: 'textarea', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(workOrderStatuses),
            },
            { name: 'cost', label: 'Cost', type: 'number' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'safety' ? (
        <OpsRecordsPanel
          title="Safety incidents"
          path="/campus-ops/safety"
          queryKeyPrefix="safety-incidents"
          branchId={branchId}
          managePermission={PERMISSIONS.SETTINGS_MANAGE}
          createSchema={createSafetyIncidentSchema}
          updateSchema={updateSafetyIncidentSchema}
          createLabel="Add incident"
          columns={[
            { key: 'incidentDate', header: 'Date' },
            { key: 'severity', header: 'Severity', badge: true },
            { key: 'summary', header: 'Summary' },
            { key: 'action', header: 'Action' },
          ]}
          fields={[
            { name: 'incidentDate', label: 'Date', type: 'date', required: true },
            {
              name: 'severity',
              label: 'Severity',
              type: 'select',
              required: true,
              options: enumOptions(safetySeverities),
            },
            { name: 'summary', label: 'Summary', type: 'textarea', required: true },
            { name: 'action', label: 'Action taken', type: 'textarea' },
          ]}
        />
      ) : tab === 'it' ? (
        <div className="space-y-6">
          <OpsStatusSummary title="Live checks">
            <ul className="space-y-2 text-[var(--text-main-900)]">
              <li>
                Biometric devices:{' '}
                {(itStatus?.devices ?? []).length
                  ? itStatus!.devices
                      .map(
                        (d) =>
                          `${d.name}${d.location ? ` (${d.location})` : ''} — ${d.isActive ? 'active' : 'inactive'}${d.lastSeenAt ? `, last seen ${d.lastSeenAt}` : ''}`,
                      )
                      .join('; ')
                  : 'none registered'}
              </li>
              <li>
                Last biometric punch:{' '}
                {itStatus?.lastBiometricPunch
                  ? `${itStatus.lastBiometricPunch.punchedAt} (${itStatus.lastBiometricPunch.device})`
                  : 'none'}
              </li>
              <li>
                Open outages:{' '}
                {(itStatus?.openOutages ?? []).length
                  ? itStatus!.openOutages.map((o) => `${o.system}: ${o.summary}`).join('; ')
                  : 'none'}
              </li>
            </ul>
          </OpsStatusSummary>
          <OpsRecordsPanel
            title="Outages"
            path="/campus-ops/it-outages"
            queryKeyPrefix="it-outages"
            branchId={branchId}
            managePermission={PERMISSIONS.SETTINGS_MANAGE}
            createSchema={createItOutageSchema}
            updateSchema={updateItOutageSchema}
            createLabel="Log outage"
            columns={[
              { key: 'startedAt', header: 'Started' },
              { key: 'system', header: 'System' },
              { key: 'summary', header: 'Summary' },
              { key: 'resolved', header: 'Resolved' },
            ]}
            fields={[
              { name: 'startedAt', label: 'Started at', type: 'datetime', required: true },
              { name: 'endedAt', label: 'Ended at', type: 'datetime' },
              { name: 'system', label: 'System', type: 'text', required: true },
              { name: 'summary', label: 'Summary', type: 'textarea', required: true },
              {
                name: 'resolved',
                label: 'Resolved',
                type: 'select',
                options: [
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ],
              },
            ]}
          />
        </div>
      ) : (
        <OpsRecordsPanel
          title="Compliance register"
          path="/campus-ops/compliance"
          queryKeyPrefix="compliance-controls"
          branchId={branchId}
          managePermission={PERMISSIONS.SETTINGS_MANAGE}
          createSchema={createComplianceControlSchema}
          updateSchema={updateComplianceControlSchema}
          createLabel="Add control"
          columns={[
            { key: 'title', header: 'Control' },
            { key: 'category', header: 'Category' },
            { key: 'dueDate', header: 'Due' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'category', label: 'Category', type: 'text', required: true },
            { name: 'dueDate', label: 'Due date', type: 'date' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(complianceControlStatuses),
            },
            { name: 'evidenceDocumentId', label: 'Evidence document id', type: 'text' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      )}
    </div>
  );
}
