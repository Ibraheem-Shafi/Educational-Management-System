'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createTransportVehicleSchema,
  transportStaffRoles,
  transportVehicleStatuses,
  updateTransportVehicleSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useUsersOptions } from '@/hooks/use-users-options';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';
import type { TransportVehicle } from './types';
import { formatLabel } from './types';

const emptyForm = {
  plateNumber: '',
  makeModel: '',
  capacity: '',
  status: 'active',
  gpsDeviceId: '',
  driverUserId: '',
  conductorUserId: '',
};

export function VehicleDialog({
  open,
  onOpenChange,
  branchId,
  vehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  vehicle?: TransportVehicle | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(vehicle);
  const [form, setForm] = useState(emptyForm);

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } = useFormErrors(
    isEdit ? updateTransportVehicleSchema : createTransportVehicleSchema,
  );

  const { data: usersData } = useUsersOptions(token, branchId, { enabled: open });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
      return;
    }
    if (vehicle) {
      const driver = vehicle.staffAssignments?.find((a) => a.role === 'driver');
      const conductor = vehicle.staffAssignments?.find((a) => a.role === 'conductor');
      setForm({
        plateNumber: vehicle.plateNumber,
        makeModel: vehicle.makeModel ?? '',
        capacity: vehicle.capacity != null ? String(vehicle.capacity) : '',
        status: vehicle.status,
        gpsDeviceId: vehicle.gpsDeviceId ?? '',
        driverUserId: driver?.userId ?? '',
        conductorUserId: conductor?.userId ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, vehicle, clearAll]);

  const userOptions = (usersData?.data ?? []).map((u) => ({
    value: u.id,
    label: u.fullName,
  }));

  const buildPayload = () => {
    const staff = [
      ...(form.driverUserId ? [{ userId: form.driverUserId, role: 'driver' as const }] : []),
      ...(form.conductorUserId ? [{ userId: form.conductorUserId, role: 'conductor' as const }] : []),
    ];

    const payload = {
      plateNumber: form.plateNumber.trim(),
      makeModel: form.makeModel.trim() || null,
      capacity: form.capacity.trim() ? Number(form.capacity) : null,
      status: form.status,
      gpsDeviceId: form.gpsDeviceId.trim() || null,
      staff,
    };

    if (isEdit && vehicle) return payload;
    return { branchId, ...payload };
  };

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => {
      if (isEdit && vehicle) {
        return apiClient(`/transport/vehicles/${vehicle.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }

      return apiClient('/transport/vehicles', {
        method: 'POST',
        token,
        body: payload,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created');
      queryClient.invalidateQueries({ queryKey: queryKeys.transportVehicles(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || (isEdit ? 'Unable to update vehicle' : 'Unable to create vehicle'));
    },
  });

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(key);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Bus className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit vehicle' : 'New vehicle'}</DialogTitle>
            <DialogDescription className="mt-1">
              {isEdit ? 'Update vehicle and staff assignments' : 'Register a transport vehicle'}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel required>Plate number</FormFieldLabel>
                <input
                  className={fieldClassName('plateNumber', modalFieldClassName)}
                  value={form.plateNumber}
                  onChange={(e) => updateForm('plateNumber', e.target.value)}
                />
                <FormFieldError message={errors.plateNumber} />
              </div>
              <div>
                <FormFieldLabel>Make / model</FormFieldLabel>
                <input
                  className={fieldClassName('makeModel', modalFieldClassName)}
                  value={form.makeModel}
                  onChange={(e) => updateForm('makeModel', e.target.value)}
                />
                <FormFieldError message={errors.makeModel} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel>Capacity</FormFieldLabel>
                <input
                  type="number"
                  min={1}
                  className={fieldClassName('capacity', modalFieldClassName)}
                  value={form.capacity}
                  onChange={(e) => updateForm('capacity', e.target.value)}
                />
                <FormFieldError message={errors.capacity} />
              </div>
              <div>
                <FormFieldLabel>Status</FormFieldLabel>
                <SelectDropdown
                  aria-label="Status"
                  value={form.status}
                  onValueChange={(value) => updateForm('status', value)}
                  options={transportVehicleStatuses.map((s) => ({
                    value: s,
                    label: formatLabel(s),
                  }))}
                  className={fieldClassName('status', 'w-full')}
                />
                <FormFieldError message={errors.status} />
              </div>
              <div>
                <FormFieldLabel>GPS device ID</FormFieldLabel>
                <input
                  className={fieldClassName('gpsDeviceId', modalFieldClassName)}
                  value={form.gpsDeviceId}
                  onChange={(e) => updateForm('gpsDeviceId', e.target.value)}
                />
                <FormFieldError message={errors.gpsDeviceId} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Driver</FormFieldLabel>
                <SelectDropdown
                  aria-label="Driver"
                  placeholder="Select driver"
                  value={form.driverUserId}
                  onValueChange={(value) => updateForm('driverUserId', value)}
                  options={[{ value: '', label: 'None' }, ...userOptions]}
                  className="w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Conductor</FormFieldLabel>
                <SelectDropdown
                  aria-label="Conductor"
                  placeholder="Select conductor"
                  value={form.conductorUserId}
                  onValueChange={(value) => updateForm('conductorUserId', value)}
                  options={[{ value: '', label: 'None' }, ...userOptions]}
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-[var(--text-sub-500)]">
              Staff roles: {transportStaffRoles.map(formatLabel).join(', ')}
            </p>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create vehicle'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
