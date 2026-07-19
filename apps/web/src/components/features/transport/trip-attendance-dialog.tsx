'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ClipboardCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { bulkTransportAttendanceSchema, transportAttendanceStatuses } from '@eims/shared';
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
import { cn } from '@/lib/utils';
import type { StudentTransportAssignment, TransportTrip } from './types';
import { formatLabel } from './types';

type AttendanceRow = { studentId: string; fullName: string; status: string };

export function TripAttendanceDialog({
  open,
  onOpenChange,
  branchId,
  trip,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  trip: TransportTrip | null;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(bulkTransportAttendanceSchema);

  const { data: assignmentsData } = useQuery({
    queryKey: queryKeys.transportStudentAssignments(branchId, { routeId: trip?.routeId }),
    queryFn: () =>
      apiClient<{ data: StudentTransportAssignment[] }>(
        `/transport/student-assignments?branchId=${branchId}&routeId=${trip?.routeId}`,
        { token },
      ),
    enabled: !!token && open && !!trip?.routeId,
  });

  const { data: tripDetail } = useQuery({
    queryKey: queryKeys.transportTrip(trip?.id ?? ''),
    queryFn: () => apiClient<TransportTrip>(`/transport/trips/${trip?.id}`, { token }),
    enabled: !!token && open && !!trip?.id,
  });

  useEffect(() => {
    if (!open) {
      setRows([]);
      clearAll();
      return;
    }
    if (!assignmentsData?.data) return;
    const existing = new Map(
      (tripDetail?.attendance ?? []).map((record) => [record.studentId, record.status]),
    );
    setRows(
      assignmentsData.data.map((assignment) => ({
        studentId: assignment.studentId,
        fullName: assignment.student?.fullName ?? 'Student',
        status: existing.get(assignment.studentId) ?? 'present',
      })),
    );
  }, [open, assignmentsData, tripDetail, clearAll]);

  const buildPayload = () => ({
    records: rows.map((row) => ({
      studentId: row.studentId,
      status: row.status,
    })),
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) => {
      if (!trip) throw new Error('Trip is required');
      return apiClient(`/transport/trips/${trip.id}/attendance/bulk`, {
        method: 'POST',
        token,
        body: payload,
      });
    },
    onSuccess: () => {
      toast.success('Attendance saved');
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to save attendance');
    },
  });

  const handleSave = () => {
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-xl" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-white">
            <ClipboardCheck className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Bulk mark attendance</DialogTitle>
            <DialogDescription className="mt-1">
              Mark transport attendance for students on this route
            </DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto px-4 py-4">
          <FormFieldError message={errors.records} />
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--text-sub-500)]">No students assigned to this route.</p>
          ) : (
            rows.map((row, index) => (
              <div key={row.studentId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm font-medium">{row.fullName}</span>
                <div>
                  <SelectDropdown
                    aria-label={`Status for ${row.fullName}`}
                    value={row.status}
                    onValueChange={(value) => {
                      setRows((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, status: value } : item)),
                      );
                      clearField(`records.${index}.status`);
                      clearField('records');
                    }}
                    options={transportAttendanceStatuses.map((s) => ({
                      value: s,
                      label: formatLabel(s),
                    }))}
                    className={fieldClassName(`records.${index}.status`, 'w-[160px]')}
                  />
                  <FormFieldError message={errors[`records.${index}.status`]} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-4 border-t px-4 pb-5 pt-4">
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border bg-white text-sm">
            Back
          </button>
          <button
            type="button"
            disabled={mutation.isPending || rows.length === 0}
            onClick={handleSave}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] text-sm text-white disabled:opacity-50',
            )}
          >
            {mutation.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
