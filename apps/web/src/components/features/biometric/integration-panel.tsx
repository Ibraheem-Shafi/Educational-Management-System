'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Radio } from 'lucide-react';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge, activeRowClass } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { ComingSoonFrame } from '@/components/coming-soon';
import { cn } from '@/lib/utils';
import type { BiometricDevice } from './types';
import { formatDateTime, statusBadgeCode } from './types';

export function IntegrationPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.BIOMETRIC_MANAGE);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const queryParams = {
    branchId,
    page,
    limit,
    isActive: true,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.biometricDevices(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
        isActive: 'true',
      });
      return apiClient<PaginatedResponse<BiometricDevice>>(
        `/biometric/devices?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const simulatePunch = useMutation({
    mutationFn: (device: BiometricDevice) =>
      apiClient('/biometric/webhooks/punch', {
        method: 'POST',
        token,
        body: {
          deviceCode: device.deviceCode,
          externalPersonId: 'DEMO-1001',
        },
      }),
    onSuccess: async () => {
      toast.success('Test punch sent');
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricPunchLogs(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricDevices(branchId) });
    },
    onError: () => toast.error('Unable to send test punch'),
  });

  const rows = data?.data ?? [];

  return (
    <ComingSoonFrame featureId="biometric-integration" className="space-y-4">
      <ContentPanel title="Webhook integration">
        <div className="space-y-3 px-5 py-4 text-sm text-[var(--text-sub-500)]">
          <p>
            Biometric devices can POST punch events to{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">
              POST /biometric/webhooks/punch
            </code>{' '}
            with body{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">
              {'{ deviceCode, externalPersonId, punchedAt?, statusCode? }'}
            </code>
            .
          </p>
          <p>
            When{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">
              BIOMETRIC_WEBHOOK_SECRET
            </code>{' '}
            is set on the API, send header{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">
              X-Biometric-Webhook-Secret
            </code>
            . Otherwise authenticated staff with <strong>biometric.manage</strong> can simulate
            punches from this tab.
          </p>
          <p>
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">statusCode</code>{' '}
            defaults to <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">present</code>{' '}
            and must match an attendance lookup code. Matched punches upsert daily attendance for
            mapped students or staff.
          </p>
        </div>
      </ContentPanel>

      <ContentPanel title={`Active devices (${data?.meta.total ?? rows.length})`}>
        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load devices.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[800px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Device</th>
                  <th className={dataTableThClass}>Code</th>
                  <th className={dataTableThClass}>Last seen</th>
                  <th className={dataTableThClass}>Status</th>
                  {canManage ? <th className={dataTableThClass}>Simulate</th> : null}
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={canManage ? 5 : 4} rows={limit} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage ? 5 : 4}
                      className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]"
                    >
                      No active devices configured
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={activeRowClass(row.isActive)}>
                      <td className={dataTableTdClass}>
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-[var(--text-sub-500)]" />
                          {row.name}
                        </div>
                      </td>
                      <td className={dataTableTdClass}>
                        <code className="text-xs">{row.deviceCode}</code>
                      </td>
                      <td className={dataTableTdClass}>{formatDateTime(row.lastSeenAt)}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={row.isActive ? 'Active' : 'Inactive'}
                          code={statusBadgeCode(row.isActive)}
                        />
                      </td>
                      {canManage ? (
                        <td className={dataTableTdClass}>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => simulatePunch.mutate(row)}
                            disabled={simulatePunch.isPending}
                          >
                            <Radio className="mr-1 h-3.5 w-3.5" />
                            Test punch
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
            {data?.meta && (
              <PaginationBar
                page={page}
                totalPages={data.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </ContentPanel>
    </ComingSoonFrame>
  );
}
