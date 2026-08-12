'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSIONS,
  transportDirections,
  transportTripStatuses,
} from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
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
import { TripDialog } from './trip-dialog';
import { TripAttendanceDialog } from './trip-attendance-dialog';
import type { TransportRoute, TransportTrip, TransportVehicle } from './types';
import { formatDate, formatLabel, statusBadgeCode } from './types';

const filterDateClassName =
  'h-10 rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 text-sm text-[var(--text-main-900,#0A0D14)]';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...transportTripStatuses.map((status) => ({
    value: status,
    label: formatLabel(status),
  })),
];

const DIRECTION_OPTIONS = [
  { value: '', label: 'All directions' },
  ...transportDirections.map((direction) => ({
    value: direction,
    label: formatLabel(direction),
  })),
];

export function TripsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [status, setStatus] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [direction, setDirection] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<TransportTrip | null>(null);
  const [attendanceTrip, setAttendanceTrip] = useState<TransportTrip | null>(null);

  const hasFilters = Boolean(status || tripDate || routeId || vehicleId || direction);

  const { data: routesData } = useQuery({
    queryKey: queryKeys.transportRoutes(branchId, { forFilter: true }),
    queryFn: () =>
      apiClient<PaginatedResponse<TransportRoute>>(
        `/transport/routes?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: queryKeys.transportVehicles(branchId, { forFilter: true }),
    queryFn: () =>
      apiClient<PaginatedResponse<TransportVehicle>>(
        `/transport/vehicles?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const queryParams = {
    page,
    limit,
    ...(status ? { status } : {}),
    ...(tripDate ? { tripDate } : {}),
    ...(routeId ? { routeId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(direction ? { direction } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportTrips(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (tripDate) params.set('tripDate', tripDate);
      if (routeId) params.set('routeId', routeId);
      if (vehicleId) params.set('vehicleId', vehicleId);
      if (direction) params.set('direction', direction);
      return apiClient<PaginatedResponse<TransportTrip>>(`/transport/trips?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Trips (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              Schedule trip
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar className="items-end">
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All statuses"
              value={status}
              onValueChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              className="w-full sm:w-[160px]"
            />
            <DateField
              label="Trip date"
              aria-label="Trip date"
              value={tripDate}
              confirmPast={false}
              onValueChange={(next) => {
                setTripDate(next);
                setPage(1);
              }}
              className={filterDateClassName}
            />
            <SelectDropdown
              aria-label="Filter by route"
              placeholder="All routes"
              value={routeId}
              onValueChange={(next) => {
                setRouteId(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All routes' },
                ...(routesData?.data.map((route) => ({
                  value: route.id,
                  label: route.name,
                })) ?? []),
              ]}
              className="w-full sm:w-[180px]"
            />
            <SelectDropdown
              aria-label="Filter by vehicle"
              placeholder="All vehicles"
              value={vehicleId}
              onValueChange={(next) => {
                setVehicleId(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All vehicles' },
                ...(vehiclesData?.data.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicle.plateNumber,
                })) ?? []),
              ]}
              className="w-full sm:w-[160px]"
            />
            <SelectDropdown
              aria-label="Filter by direction"
              placeholder="All directions"
              value={direction}
              onValueChange={(next) => {
                setDirection(next);
                setPage(1);
              }}
              options={DIRECTION_OPTIONS}
              className="w-full sm:w-[160px]"
            />
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus('');
                  setTripDate('');
                  setRouteId('');
                  setVehicleId('');
                  setDirection('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load trips.</p>
        ) : (
          <>
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
                    <DataTableSkeletonRows columns={7} rows={limit} />
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
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditTrip(row) },
                                { label: 'Mark attendance', onClick: () => setAttendanceTrip(row) },
                              ]}
                            />
                          </PermissionGate>
                        </td>
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
