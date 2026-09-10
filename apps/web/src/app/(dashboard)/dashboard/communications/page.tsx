'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, MessageSquare } from 'lucide-react';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import type { CommunicationLog, CommunicationsProviderConfig, CommunicationsStatsResponse, PaginatedResponse } from '@eims/types';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { SendMessageDialog } from '@/components/features/communications/send-message-dialog';
import { Button } from '@/components/ui/button';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function channelShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export default function CommunicationsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canSend = can(PERMISSIONS.COMMUNICATIONS_SEND);
  const [sendOpen, setSendOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logLimit, setLogLimit] = useState(8);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setLogPage(1);
  }, []);

  const { effectiveScope, scopeKey, appendToSearchParams } = useEffectiveBranchScope();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.communicationsStats, scopeKey],
    queryFn: () =>
      apiClient<CommunicationsStatsResponse>(
        withBranchScope('/communications/stats', effectiveScope),
        { token },
      ),
    enabled: !!token,
  });

  const { data: providerConfig } = useQuery({
    queryKey: ['communications-config'],
    queryFn: () => apiClient<CommunicationsProviderConfig>('/communications/config', { token }),
    enabled: !!token && canSend,
  });

  const queryParams = new URLSearchParams({
    page: String(logPage),
    limit: String(logLimit),
  });
  appendToSearchParams(queryParams);
  if (search) queryParams.set('search', search);
  if (channelFilter) queryParams.set('channel', channelFilter);
  if (statusFilter) queryParams.set('status', statusFilter);

  const { data: logs, isLoading, error } = useQuery({
    queryKey: [
      'communication-logs',
      scopeKey,
      logPage,
      logLimit,
      search,
      channelFilter,
      statusFilter,
    ],
    queryFn: () =>
      apiClient<PaginatedResponse<CommunicationLog>>(
        `/communications/logs?${queryParams.toString()}`,
        { token },
      ),
    enabled: !!token,
  });

  const filteredLogs = logs?.data ?? [];

  const smsTotal = stats?.smsCount.total ?? 0;
  const whatsappTotal = stats?.whatsappCount.total ?? 0;
  const channelTotal = smsTotal + whatsappTotal;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={MessageSquare}
        title="Communications"
        description="Alerts sent when staff publish notices, mark absences, remind fees, or publish results"
        actions={
          canSend ? (
            <button
              type="button"
              onClick={() => setSendOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              Send message
            </button>
          ) : undefined
        }
      />

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} />

      {canSend && providerConfig && !providerConfig.whatsappConfigured ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-[10px] border border-[var(--palette-yellow)]/35 border-l-[4px] border-l-[var(--palette-yellow)] bg-[var(--palette-yellow-soft)] px-4 py-4"
        >
          <Info className="h-4 w-4 shrink-0 text-[var(--midnight-blue-950,#01366C)]" aria-hidden />
          <p className="text-sm text-[var(--text-sub-500)]">
            WhatsApp is not configured. The institution must set <code>TWILIO_WHATSAPP_FROM</code> and
            template content SIDs on the API. Until then, alerts are logged here and families still see
            notices in the portal.
          </p>
        </div>
      ) : null}

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Sent (30d)',
            value: formatCount(stats?.sentLast30Days.total ?? 0),
            changePercent: stats?.sentLast30Days.changePercent,
          },
          {
            label: 'Failed (30d)',
            value: formatCount(stats?.failedLast30Days.total ?? 0),
            changePercent: stats?.failedLast30Days.changePercent,
          },
          {
            label: 'SMS messages',
            value: formatCount(smsTotal),
            changePercent: stats?.smsCount.changePercent,
          },
          {
            label: 'WhatsApp messages',
            value: formatCount(whatsappTotal),
            changePercent: stats?.whatsappCount.changePercent,
          },
        ]}
      />

      <MetricDonutCard
        title="Channel distribution"
        subtitle="Last 30 days"
        isLoading={statsLoading}
        segments={[
          {
            label: 'SMS',
            rate: channelShare(smsTotal, channelTotal),
            color: 'var(--palette-teal)',
          },
          {
            label: 'WhatsApp',
            rate: channelShare(whatsappTotal, channelTotal),
            color: 'var(--palette-green)',
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} placeholder="Search recipient" />
        <SelectDropdown
          aria-label="Filter by channel"
          placeholder="All channels"
          value={channelFilter}
          onValueChange={(next) => {
            setChannelFilter(next);
            setLogPage(1);
          }}
          options={[
            { value: '', label: 'All channels' },
            { value: 'sms', label: 'SMS' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]}
        />
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="All statuses"
          value={statusFilter}
          onValueChange={(next) => {
            setStatusFilter(next);
            setLogPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'queued', label: 'Queued' },
            { value: 'sent', label: 'Sent' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'read', label: 'Read' },
            { value: 'failed', label: 'Failed' },
            { value: 'fallback_sms', label: 'SMS fallback' },
          ]}
        />
        <PageBranchScopeControl />
        {(search || channelFilter || statusFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setChannelFilter('');
              setStatusFilter('');
              setLogPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Channel</th>
                <th className={dataTableThClass}>Recipient</th>
                <th className={dataTableThClass}>Template</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Sent at</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={5} rows={logLimit} />}

              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load messages
                  </td>
                </tr>
              )}

              {!isLoading && !error && filteredLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No messages found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={cn('transition-colors', statusRowClass(log.status, log.status))}
                  >
                    <td className={cn(dataTableTdClass, 'uppercase')}>{log.channel}</td>
                    <td className={dataTableTdClass}>{log.recipient}</td>
                    <td className={dataTableTdClass}>
                      {(log.templateKey ?? log.campaign?.templateKey ?? log.subject ?? '—').replaceAll('_', ' ')}
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge
                        label={log.status.replaceAll('_', ' ')}
                        code={log.status}
                      />
                    </td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {logs?.meta && (
          <PaginationBar
            page={logPage}
            totalPages={logs.meta.totalPages}
            limit={logLimit}
            onPageChange={setLogPage}
            onLimitChange={(next) => {
              setLogLimit(next);
              setLogPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
