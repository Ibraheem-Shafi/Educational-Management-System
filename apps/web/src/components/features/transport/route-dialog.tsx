'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TransportRoute } from './types';

type StopForm = {
  name: string;
  sequence: string;
  pickupTime: string;
  dropoffTime: string;
};

const emptyStop = (): StopForm => ({
  name: '',
  sequence: '1',
  pickupTime: '',
  dropoffTime: '',
});

export function RouteDialog({
  open,
  onOpenChange,
  branchId,
  route,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  route?: TransportRoute | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(route);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [stops, setStops] = useState<StopForm[]>([emptyStop()]);

  useEffect(() => {
    if (!open) {
      setName('');
      setCode('');
      setIsActive(true);
      setStops([emptyStop()]);
      return;
    }
    if (route) {
      setName(route.name);
      setCode(route.code ?? '');
      setIsActive(route.isActive);
      setStops(
        (route.stops ?? []).length > 0
          ? (route.stops ?? []).map((stop) => ({
              name: stop.name,
              sequence: String(stop.sequence),
              pickupTime: stop.pickupTime ?? '',
              dropoffTime: stop.dropoffTime ?? '',
            }))
          : [emptyStop()],
      );
    }
  }, [open, route]);

  const mutation = useMutation({
    mutationFn: () => {
      const stopPayload = stops
        .filter((stop) => stop.name.trim())
        .map((stop) => ({
          name: stop.name.trim(),
          sequence: Number(stop.sequence),
          pickupTime: stop.pickupTime.trim() || null,
          dropoffTime: stop.dropoffTime.trim() || null,
        }));

      if (stopPayload.length === 0) throw new Error('At least one stop is required');

      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        isActive,
        stops: stopPayload,
      };

      if (isEdit && route) {
        return apiClient(`/transport/routes/${route.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }

      return apiClient('/transport/routes', {
        method: 'POST',
        token,
        body: { branchId, ...payload },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Route updated' : 'Route created');
      queryClient.invalidateQueries({ queryKey: queryKeys.transportRoutes(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = name.trim().length >= 1 && stops.some((s) => s.name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-2xl" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <MapPin className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit route' : 'New route'}</DialogTitle>
            <DialogDescription className="mt-1">
              Define route details and ordered stops (stops are replaced on save)
            </DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="flex h-6 w-6 items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel required>Route name</FormFieldLabel>
                <input className={modalFieldClassName} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <FormFieldLabel>Code</FormFieldLabel>
                <input className={modalFieldClassName} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active route
            </label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormFieldLabel required>Stops</FormFieldLabel>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setStops((prev) => [...prev, { ...emptyStop(), sequence: String(prev.length + 1) }])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add stop
                </Button>
              </div>

              {stops.map((stop, index) => (
                <div key={index} className="rounded-lg border border-stroke-soft-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-sub-500)]">Stop {index + 1}</span>
                    {stops.length > 1 ? (
                      <button
                        type="button"
                        className="text-[var(--text-sub-500)] hover:text-red-600"
                        onClick={() => setStops((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Remove stop"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <input
                      className={modalFieldClassName}
                      placeholder="Stop name"
                      value={stop.name}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)),
                        )
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      className={modalFieldClassName}
                      placeholder="Seq"
                      value={stop.sequence}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, sequence: e.target.value } : item)),
                        )
                      }
                    />
                    <input
                      className={modalFieldClassName}
                      placeholder="Pickup (07:30)"
                      value={stop.pickupTime}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, pickupTime: e.target.value } : item)),
                        )
                      }
                    />
                    <input
                      className={modalFieldClassName}
                      placeholder="Dropoff (14:00)"
                      value={stop.dropoffTime}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, dropoffTime: e.target.value } : item)),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button type="button" onClick={() => onOpenChange(false)} className={cn('inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border bg-white text-sm')}>
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] text-sm text-white disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create route'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
