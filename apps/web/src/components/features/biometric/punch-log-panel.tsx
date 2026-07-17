'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import type { BiometricPunchLog } from './types';
import { formatDateTime, matchedBadgeCode } from './types';

export function PunchLogPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const [search, setSearch] = useState('');
  const [matchedFilter, setMatchedFilter] = useState('');

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    limit: 100,
    ...(search ? { externalPersonId: search } : {}),
    ...(matchedFilter ? { matched: matchedFilter === 'true' } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.biometricPunchLogs(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId, limit: '100' });
      if (search) params.set('externalPersonId', search);
      if (matchedFilter) params.set('matched', matchedFilter);
      return apiClient<{ data: BiometricPunchLog[] }>(
        `/biometric/punch-logs?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    refetchInterval: 30_000,
  });

  const rows = data?.data ?? [];

  return (
    <ContentPanel title={`Punch log (${rows.length})`}>
      <div className="border-b border-stroke-soft-200 px-5 py-4">
        <FilterBar>
          <SearchInput
            value={search}
            onValueChange={handleSearchChange}
            placeholder="Filter by external person ID"
            className="min-w-[220px] flex-1 sm:max-w-xs"
          />
          <SelectDropdown
            aria-label="Matched filter"
            placeholder="All punches"
            value={matchedFilter}
            onValueChange={setMatchedFilter}
            options={[
              { value: '', label: 'All punches' },
              { value: 'true', label: 'Matched only' },
              { value: 'false', label: 'Unmatched only' },
            ]}
            className="w-full sm:w-[180px]"
          />
        </FilterBar>
      </div>

      {error ? (
        <p className="px-5 py-8 text-sm text-red-600">Unable to load punch logs.</p>
      ) : (
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[960px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Punched at</th>
                <th className={dataTableThClass}>External ID</th>
                <th className={dataTableThClass}>Device</th>
                <th className={dataTableThClass}>Matched</th>
                <th className={dataTableThClass}>Attendance record</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading ? (
                <DataTableSkeletonRows columns={5} rows={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No punch logs yet
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={dataTableRowHoverClass}>
                    <td className={dataTableTdClass}>{formatDateTime(row.punchedAt)}</td>
                    <td className={dataTableTdClass}>
                      <code className="text-xs">{row.externalPersonId}</code>
                    </td>
                    <td className={dataTableTdClass}>
                      {row.device
                        ? `${row.device.name} (${row.device.deviceCode})`
                        : row.deviceId}
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge
                        label={row.matched ? 'Matched' : 'Unmatched'}
                        code={matchedBadgeCode(row.matched)}
                      />
                    </td>
                    <td className={dataTableTdClass}>
                      {row.attendanceRecordId ? (
                        <code className="text-xs">{row.attendanceRecordId.slice(0, 12)}…</code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </ContentPanel>
  );
}
