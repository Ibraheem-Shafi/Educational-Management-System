'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { TripDialog } from './trip-dialog';
import { TripAttendanceDialog } from './trip-attendance-dialog';
import type { TransportTrip } from './types';
import { formatDate, formatLabel, statusBadgeCode } from './types';

export function TripsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.TRANSPORT_MANAGE);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<TransportTrip | null>(null);
  const [attendanceTrip, setAttendanceTrip] = useState<TransportTrip | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportTrips(branchId),
    queryFn: () =>
      apiClient<{ data: TransportTrip[] }>(`/transport/trips?branchId=${branchId}`, { token }),
    enabled: !!token && !!branchId,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Trips (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              Schedule trip
            </button>
          </PermissionGate>
        }
      >
        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load trips.</p>
        ) : (
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[960px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Date</th>
                  <th className={dataTableThClass}>Route</th>
                  <th className={dataTableThClass}>Vehicle</th>
                  <th className={dataTableThClass}>Direction</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Attendance</th>
                  <th className={dataTableThClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={7} rows={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No trips scheduled
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>{formatDate(row.tripDate)}</td>
                      <td className={dataTableTdClass}>{row.route?.name ?? '—'}</td>
                      <td className={dataTableTdClass}>{row.vehicle?.plateNumber ?? '—'}</td>
                      <td className={dataTableTdClass}>{formatLabel(row.direction)}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge label={formatLabel(row.status)} code={statusBadgeCode(row.status)} />
                      </td>
                      <td className={dataTableTdClass}>{row._count?.attendance ?? 0}</td>
                      <td className={dataTableTdClass}>
                        <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE} fallback="—">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditTrip(row)}
                              aria-label="Edit trip"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setAttendanceTrip(row)}
                              aria-label="Mark attendance"
                              disabled={!canManage}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      <TripDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <TripDialog
        open={Boolean(editTrip)}
        onOpenChange={(open) => {
          if (!open) setEditTrip(null);
        }}
        branchId={branchId}
        trip={editTrip}
      />
      <TripAttendanceDialog
        open={Boolean(attendanceTrip)}
        onOpenChange={(open) => {
          if (!open) setAttendanceTrip(null);
        }}
        branchId={branchId}
        trip={attendanceTrip}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.transportTrips(branchId) });
        }}
      />
    </>
  );
}
