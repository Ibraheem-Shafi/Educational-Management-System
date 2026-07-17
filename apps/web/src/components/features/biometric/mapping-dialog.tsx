'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, X } from 'lucide-react';
import { toast } from 'sonner';
import { biometricEntityTypes } from '@eims/shared';
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
import type { BiometricDevice, BiometricMapping } from './types';
import { formatLabel } from './types';

const emptyForm = {
  externalPersonId: '',
  entityType: 'student',
  entityId: '',
  deviceId: '',
};

export function MappingDialog({
  open,
  onOpenChange,
  branchId,
  mapping,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  mapping?: BiometricMapping | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(mapping);
  const [form, setForm] = useState(emptyForm);

  const { data: devicesData } = useQuery({
    queryKey: queryKeys.biometricDevices(branchId),
    queryFn: () =>
      apiClient<{ data: BiometricDevice[] }>(`/biometric/devices?branchId=${branchId}`, { token }),
    enabled: !!token && open,
  });

  const { data: studentsData } = useQuery({
    queryKey: queryKeys.students({ branchId, limit: 200 }),
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>(
        `/students?branchId=${branchId}&limit=200`,
        { token },
      ),
    enabled: !!token && open && form.entityType === 'student',
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', branchId],
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>(
        `/users?limit=100&branchId=${branchId}`,
        { token },
      ),
    enabled: !!token && open && form.entityType === 'user',
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }
    if (mapping) {
      setForm({
        externalPersonId: mapping.externalPersonId,
        entityType: mapping.entityType,
        entityId: mapping.entityId,
        deviceId: mapping.deviceId ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mapping]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        branchId,
        externalPersonId: form.externalPersonId.trim(),
        entityType: form.entityType as 'student' | 'user',
        entityId: form.entityId,
        deviceId: form.deviceId || null,
      };
      if (isEdit && mapping) {
        return apiClient(`/biometric/mappings/${mapping.id}`, {
          method: 'PATCH',
          token,
          body: {
            externalPersonId: body.externalPersonId,
            entityType: body.entityType,
            entityId: body.entityId,
            deviceId: body.deviceId,
          },
        });
      }
      return apiClient('/biometric/mappings', { method: 'POST', token, body });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Mapping updated' : 'Mapping created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricMappings(branchId) });
      onOpenChange(false);
    },
    onError: () => toast.error(isEdit ? 'Unable to update mapping' : 'Unable to create mapping'),
  });

  const entityOptions =
    form.entityType === 'student'
      ? (studentsData?.data ?? []).map((s) => ({ value: s.id, label: s.fullName }))
      : (usersData?.data ?? []).map((u) => ({ value: u.id, label: u.fullName }));

  const deviceOptions = [
    { value: '', label: 'Any device (branch-wide)' },
    ...(devicesData?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (${d.deviceCode})`,
    })),
  ];

  const canSubmit = form.externalPersonId.trim() && form.entityId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-[var(--text-sub-500)]" />
            <DialogTitle>{isEdit ? 'Edit mapping' : 'New ID mapping'}</DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5 text-[var(--text-sub-500)]" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Map a biometric external person ID to a student or staff user
        </DialogDescription>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) save.mutate();
          }}
        >
          <div>
            <FormFieldLabel htmlFor="mapping-external-id">External person ID</FormFieldLabel>
            <input
              id="mapping-external-id"
              className={modalFieldClassName}
              value={form.externalPersonId}
              onChange={(e) => setForm((f) => ({ ...f, externalPersonId: e.target.value }))}
              required
            />
          </div>
          <div>
            <FormFieldLabel htmlFor="mapping-entity-type">Entity type</FormFieldLabel>
            <SelectDropdown
              aria-label="Entity type"
              value={form.entityType}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, entityType: value, entityId: '' }))
              }
              options={biometricEntityTypes.map((t) => ({ value: t, label: formatLabel(t) }))}
              className="w-full"
            />
          </div>
          <div>
            <FormFieldLabel htmlFor="mapping-entity-id">
              {form.entityType === 'student' ? 'Student' : 'Staff user'}
            </FormFieldLabel>
            <SelectDropdown
              aria-label="Entity"
              placeholder={`Select ${form.entityType}`}
              value={form.entityId}
              onValueChange={(value) => setForm((f) => ({ ...f, entityId: value }))}
              options={entityOptions}
              className="w-full"
            />
          </div>
          <div>
            <FormFieldLabel htmlFor="mapping-device">Device (optional)</FormFieldLabel>
            <SelectDropdown
              aria-label="Device"
              value={form.deviceId}
              onValueChange={(value) => setForm((f) => ({ ...f, deviceId: value }))}
              options={deviceOptions}
              className="w-full"
            />
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
              disabled={!canSubmit || save.isPending}
              className="rounded-lg bg-[var(--primary-base)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create mapping'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
