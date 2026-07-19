'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import type { TransportVehicle } from './types';
import { formatCoords, formatDateTime, formatLabel, statusBadgeCode } from './types';

export function GpsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.TRANSPORT_MANAGE);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const queryParams = { page, limit, panel: 'gps' as const };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportVehicles(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      return apiClient<PaginatedResponse<TransportVehicle>>(
        `/transport/vehicles?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    refetchInterval: 30_000,
  });

  const simulatePing = useMutation({
    mutationFn: (vehicle: TransportVehicle) =>
      apiClient('/transport/gps/webhook', {
        method: 'POST',
        token,
        body: {
          deviceId: vehicle.gpsDeviceId,
          lat: (vehicle.lastLat ?? 33.6844) + (Math.random() - 0.5) * 0.01,
          lng: (vehicle.lastLng ?? 73.0479) + (Math.random() - 0.5) * 0.01,
        },
      }),
    onSuccess: async () => {
      toast.success('GPS ping sent');
      await queryClient.invalidateQueries({ queryKey: queryKeys.transportVehicles(branchId) });
    },
    onError: () => toast.error('Unable to send GPS ping'),
  });

  const rows = (data?.data ?? []).filter((v) => v.gpsDeviceId);

  return (
    <div className="space-y-4">
      <ContentPanel title="GPS integration">
        <div className="space-y-3 px-5 py-4 text-sm text-[var(--text-sub-500)]">
          <p>
            External GPS trackers can POST location updates to{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">POST /transport/gps/webhook</code>{' '}
            with body{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">
              {'{ deviceId, lat, lng, recordedAt? }'}
            </code>
            .
          </p>
          <p>
            When <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">TRANSPORT_GPS_WEBHOOK_SECRET</code>{' '}
            is set on the API, send header{' '}
            <code className="rounded bg-[var(--neutral-50)] px-1.5 py-0.5 text-xs">X-GPS-Webhook-Secret</code>.
            Otherwise authenticated staff with <strong>transport.manage</strong> can simulate pings from this tab.
          </p>
        </div>
      </ContentPanel>

      <ContentPanel title={`Live positions (${data?.meta.total ?? rows.length})`}>
        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load GPS data.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[900px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Vehicle</th>
                    <th className={dataTableThClass}>Device ID</th>
                    <th className={dataTableThClass}>Last position</th>
                    <th className={dataTableThClass}>Last ping</th>
                    <th className={dataTableThClass}>Status</th>
                    {canManage ? <th className={dataTableThClass}>Simulate</th> : null}
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={canManage ? 6 : 5} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage ? 6 : 5}
                        className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]"
                      >
                        No vehicles with GPS device IDs configured
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[var(--text-sub-500)]" />
                            {row.plateNumber}
                          </div>
                        </td>
                        <td className={dataTableTdClass}>{row.gpsDeviceId}</td>
                        <td className={dataTableTdClass}>{formatCoords(row.lastLat, row.lastLng)}</td>
                        <td className={dataTableTdClass}>{formatDateTime(row.lastPingAt)}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge label={formatLabel(row.status)} code={statusBadgeCode(row.status)} />
                        </td>
                        {canManage ? (
                          <td className={dataTableTdClass}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => simulatePing.mutate(row)}
                              disabled={simulatePing.isPending}
                            >
                              <Radio className="mr-1 h-3.5 w-3.5" />
                              Ping
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
    </div>
  );
}
