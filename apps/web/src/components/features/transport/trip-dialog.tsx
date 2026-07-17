'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import { transportDirections, transportTripStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';
import type { TransportRoute, TransportTrip, TransportVehicle } from './types';
import { formatLabel } from './types';

export function TripDialog({
  open,
  onOpenChange,
  branchId,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  trip?: TransportTrip | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(trip);
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [direction, setDirection] = useState('pickup');
  const [status, setStatus] = useState('scheduled');

  const { data: routesData } = useQuery({
    queryKey: queryKeys.transportRoutes(branchId),
    queryFn: () =>
      apiClient<{ data: TransportRoute[] }>(`/transport/routes?branchId=${branchId}`, { token }),
    enabled: !!token && open,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: queryKeys.transportVehicles(branchId),
    queryFn: () =>
      apiClient<{ data: TransportVehicle[] }>(`/transport/vehicles?branchId=${branchId}`, { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setRouteId('');
      setVehicleId('');
      setTripDate('');
      setDirection('pickup');
      setStatus('scheduled');
      return;
    }
    if (trip) {
      setRouteId(trip.routeId);
      setVehicleId(trip.vehicleId ?? '');
      setTripDate(trip.tripDate.slice(0, 10));
      setDirection(trip.direction);
      setStatus(trip.status);
    }
  }, [open, trip]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        routeId,
        vehicleId: vehicleId || null,
        tripDate,
        direction,
        status,
      };
      if (isEdit && trip) {
        return apiClient(`/transport/trips/${trip.id}`, { method: 'PATCH', token, body: payload });
      }
      return apiClient('/transport/trips', {
        method: 'POST',
        token,
        body: { branchId, ...payload },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Trip updated' : 'Trip scheduled');
      queryClient.invalidateQueries({ queryKey: queryKeys.transportTrips(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = routeId && tripDate && direction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-white">
            <Calendar className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit trip' : 'Schedule trip'}</DialogTitle>
            <DialogDescription className="mt-1">Plan a transport trip for a route</DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex flex-col gap-4 px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <FormFieldLabel required>Route</FormFieldLabel>
            <SelectDropdown
              aria-label="Route"
              value={routeId}
              onValueChange={setRouteId}
              options={(routesData?.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              className="w-full"
            />
          </div>
          <div>
            <FormFieldLabel>Vehicle</FormFieldLabel>
            <SelectDropdown
              aria-label="Vehicle"
              placeholder="Optional"
              value={vehicleId}
              onValueChange={setVehicleId}
              options={[
                { value: '', label: 'None' },
                ...(vehiclesData?.data ?? []).map((v) => ({
                  value: v.id,
                  label: v.plateNumber,
                })),
              ]}
              className="w-full"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FormFieldLabel required>Trip date</FormFieldLabel>
              <input
                type="date"
                className={modalFieldClassName}
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
              />
            </div>
            <div>
              <FormFieldLabel required>Direction</FormFieldLabel>
              <SelectDropdown
                aria-label="Direction"
                value={direction}
                onValueChange={setDirection}
                options={transportDirections.map((d) => ({ value: d, label: formatLabel(d) }))}
                className="w-full"
              />
            </div>
            <div>
              <FormFieldLabel>Status</FormFieldLabel>
              <SelectDropdown
                aria-label="Status"
                value={status}
                onValueChange={setStatus}
                options={transportTripStatuses.map((s) => ({ value: s, label: formatLabel(s) }))}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border bg-white text-sm">
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] text-sm text-white disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule trip'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
