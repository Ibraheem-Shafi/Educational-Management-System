'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  biometricVendors,
  createBiometricDeviceSchema,
  updateBiometricDeviceSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
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
import type { BiometricDevice } from './types';
import { formatLabel } from './types';

const emptyForm = {
  name: '',
  vendor: 'generic',
  deviceCode: '',
  location: '',
  isActive: 'true',
};

export function DeviceDialog({
  open,
  onOpenChange,
  branchId,
  device,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  device?: BiometricDevice | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(device);
  const [form, setForm] = useState(emptyForm);

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } = useFormErrors(
    isEdit ? updateBiometricDeviceSchema : createBiometricDeviceSchema,
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
      return;
    }
    if (device) {
      setForm({
        name: device.name,
        vendor: device.vendor,
        deviceCode: device.deviceCode,
        location: device.location ?? '',
        isActive: device.isActive ? 'true' : 'false',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, device, clearAll]);

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      vendor: form.vendor,
      deviceCode: form.deviceCode.trim(),
      location: form.location.trim() || null,
      isActive: form.isActive === 'true',
    };
    if (isEdit && device) return payload;
    return { branchId, ...payload };
  };

  const save = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => {
      if (isEdit && device) {
        return apiClient(`/biometric/devices/${device.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }
      return apiClient('/biometric/devices', { method: 'POST', token, body: payload });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Device updated' : 'Device created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricDevices(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || (isEdit ? 'Unable to update device' : 'Unable to create device'));
    },
  });

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearField(key);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    save.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-[var(--text-sub-500)]" />
            <DialogTitle>{isEdit ? 'Edit device' : 'New biometric device'}</DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5 text-[var(--text-sub-500)]" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          {isEdit ? 'Update biometric device details' : 'Register a new biometric device'}
        </DialogDescription>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div>
            <FormFieldLabel htmlFor="device-name">Name</FormFieldLabel>
            <input
              id="device-name"
              className={fieldClassName('name', modalFieldClassName)}
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
            />
            <FormFieldError message={errors.name} />
          </div>
          <div>
            <FormFieldLabel htmlFor="device-code">Device code</FormFieldLabel>
            <input
              id="device-code"
              className={fieldClassName('deviceCode', modalFieldClassName)}
              value={form.deviceCode}
              onChange={(e) => updateForm('deviceCode', e.target.value)}
              disabled={isEdit}
            />
            <FormFieldError message={errors.deviceCode} />
          </div>
          <div>
            <FormFieldLabel htmlFor="device-vendor">Vendor</FormFieldLabel>
            <SelectDropdown
              aria-label="Vendor"
              value={form.vendor}
              onValueChange={(value) => updateForm('vendor', value)}
              options={biometricVendors.map((v) => ({ value: v, label: formatLabel(v) }))}
              className={fieldClassName('vendor', 'w-full')}
            />
            <FormFieldError message={errors.vendor} />
          </div>
          <div>
            <FormFieldLabel htmlFor="device-location">Location</FormFieldLabel>
            <input
              id="device-location"
              className={fieldClassName('location', modalFieldClassName)}
              value={form.location}
              onChange={(e) => updateForm('location', e.target.value)}
            />
            <FormFieldError message={errors.location} />
          </div>
          <div>
            <FormFieldLabel htmlFor="device-active">Status</FormFieldLabel>
            <SelectDropdown
              aria-label="Status"
              value={form.isActive}
              onValueChange={(value) => updateForm('isActive', value)}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              className={fieldClassName('isActive', 'w-full')}
            />
            <FormFieldError message={errors.isActive} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className={cn(
                'rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm font-medium',
              )}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-[var(--primary-base)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create device'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
