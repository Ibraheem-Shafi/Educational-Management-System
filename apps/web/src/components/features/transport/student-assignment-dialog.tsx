'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createStudentTransportSchema,
  transportDirections,
  updateStudentTransportSchema,
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
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';
import type { StudentTransportAssignment, TransportRoute } from './types';
import { formatLabel } from './types';

export function StudentAssignmentDialog({
  open,
  onOpenChange,
  branchId,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  assignment?: StudentTransportAssignment | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(assignment);
  const [studentId, setStudentId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [direction, setDirection] = useState('both');

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } = useFormErrors(
    isEdit ? updateStudentTransportSchema : createStudentTransportSchema,
  );

  const { data: studentsData } = useQuery({
    queryKey: queryKeys.students({ branchId, limit: 100 }),
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>(
        `/students?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && open,
  });

  const { data: routesData } = useQuery({
    queryKey: queryKeys.transportRoutes(branchId),
    queryFn: () =>
      apiClient<{ data: TransportRoute[] }>(`/transport/routes?branchId=${branchId}`, { token }),
    enabled: !!token && open,
  });

  const selectedRoute = useMemo(
    () => (routesData?.data ?? []).find((route) => route.id === routeId),
    [routesData, routeId],
  );

  useEffect(() => {
    if (!open) {
      setStudentId('');
      setRouteId('');
      setStopId('');
      setDirection('both');
      clearAll();
      return;
    }
    if (assignment) {
      setStudentId(assignment.studentId);
      setRouteId(assignment.routeId);
      setStopId(assignment.stopId);
      setDirection(assignment.direction);
    }
  }, [open, assignment, clearAll]);

  useEffect(() => {
    if (!selectedRoute?.stops?.some((stop) => stop.id === stopId)) {
      setStopId(selectedRoute?.stops?.[0]?.id ?? '');
    }
  }, [selectedRoute, stopId]);

  const buildPayload = () => {
    const payload = { studentId, routeId, stopId, direction };
    if (isEdit && assignment) return payload;
    return { branchId, ...payload };
  };

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => {
      if (isEdit && assignment) {
        return apiClient(`/transport/student-assignments/${assignment.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }
      return apiClient('/transport/student-assignments', {
        method: 'POST',
        token,
        body: payload,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Assignment updated' : 'Student assigned');
      queryClient.invalidateQueries({ queryKey: queryKeys.transportStudentAssignments(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || (isEdit ? 'Unable to update assignment' : 'Unable to assign student'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-white">
            <UserRound className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit assignment' : 'Assign student'}</DialogTitle>
            <DialogDescription className="mt-1">Link a student to a route stop</DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="flex flex-col gap-4 px-4 py-4" onSubmit={handleSubmit}>
          <div>
            <FormFieldLabel required>Student</FormFieldLabel>
            <SelectDropdown
              aria-label="Student"
              placeholder="Select student"
              value={studentId}
              onValueChange={(value) => {
                setStudentId(value);
                clearField('studentId');
              }}
              options={(studentsData?.data ?? []).map((s) => ({ value: s.id, label: s.fullName }))}
              className={fieldClassName('studentId', 'w-full')}
            />
            <FormFieldError message={errors.studentId} />
          </div>
          <div>
            <FormFieldLabel required>Route</FormFieldLabel>
            <SelectDropdown
              aria-label="Route"
              placeholder="Select route"
              value={routeId}
              onValueChange={(value) => {
                setRouteId(value);
                clearField('routeId');
              }}
              options={(routesData?.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              className={fieldClassName('routeId', 'w-full')}
            />
            <FormFieldError message={errors.routeId} />
          </div>
          <div>
            <FormFieldLabel required>Stop</FormFieldLabel>
            <SelectDropdown
              aria-label="Stop"
              placeholder="Select stop"
              value={stopId}
              onValueChange={(value) => {
                setStopId(value);
                clearField('stopId');
              }}
              options={(selectedRoute?.stops ?? []).map((s) => ({
                value: s.id,
                label: `${s.sequence}. ${s.name}`,
              }))}
              className={fieldClassName('stopId', 'w-full')}
            />
            <FormFieldError message={errors.stopId} />
          </div>
          <div>
            <FormFieldLabel required>Direction</FormFieldLabel>
            <SelectDropdown
              aria-label="Direction"
              value={direction}
              onValueChange={(value) => {
                setDirection(value);
                clearField('direction');
              }}
              options={transportDirections.map((d) => ({ value: d, label: formatLabel(d) }))}
              className={fieldClassName('direction', 'w-full')}
            />
            <FormFieldError message={errors.direction} />
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border bg-white text-sm">
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] text-sm text-white disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Assign student'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
