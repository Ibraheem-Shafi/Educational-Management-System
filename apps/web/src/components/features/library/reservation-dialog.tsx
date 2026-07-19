'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, X } from 'lucide-react';
import { toast } from 'sonner';
import { createLibraryReservationSchema } from '@eims/shared';
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
import type { LibraryBook } from './types';

export function ReservationDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [bookId, setBookId] = useState('');
  const [studentId, setStudentId] = useState('');

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(createLibraryReservationSchema);

  const { data: booksData } = useQuery({
    queryKey: queryKeys.libraryBooks(branchId),
    queryFn: () =>
      apiClient<{ data: LibraryBook[] }>(`/library/books?branchId=${branchId}`, { token }),
    enabled: !!token && !!branchId && open,
  });

  const { data: studentsData } = useQuery({
    queryKey: queryKeys.students({ branchId, limit: 200 }),
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>(
        `/students?branchId=${branchId}&limit=200`,
        { token },
      ),
    enabled: !!token && !!branchId && open,
  });

  useEffect(() => {
    if (!open) {
      setBookId('');
      setStudentId('');
      clearAll();
    }
  }, [open, clearAll]);

  const buildPayload = () => ({
    branchId,
    bookId,
    borrowerType: 'student' as const,
    studentId,
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/library/reservations', {
        method: 'POST',
        token,
        body: payload,
      }),
    onSuccess: async () => {
      toast.success('Reservation created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryReservations(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to create reservation');
    },
  });

  const handleSave = () => {
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Bookmark className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>New reservation</DialogTitle>
            <DialogDescription className="sr-only">Reserve a book for a student</DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-neutral-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div>
              <FormFieldLabel htmlFor="reserve-book">Book</FormFieldLabel>
              <SelectDropdown
                aria-label="Book"
                placeholder="Select book"
                value={bookId}
                onValueChange={(value) => {
                  setBookId(value);
                  clearField('bookId');
                }}
                options={(booksData?.data ?? []).map((b) => ({
                  value: b.id,
                  label: `${b.title} — ${b.author}`,
                }))}
                className={fieldClassName('bookId', 'w-full')}
              />
              <FormFieldError message={errors.bookId} />
            </div>
            <div>
              <FormFieldLabel htmlFor="reserve-student">Student</FormFieldLabel>
              <SelectDropdown
                aria-label="Student"
                placeholder="Select student"
                value={studentId}
                onValueChange={(value) => {
                  setStudentId(value);
                  clearField('studentId');
                }}
                options={(studentsData?.data ?? []).map((s) => ({
                  value: s.id,
                  label: s.fullName,
                }))}
                className={fieldClassName('studentId', 'w-full')}
              />
              <FormFieldError message={errors.studentId} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={handleSave}
            className={cn(
              'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
              mutation.isPending && 'opacity-50',
            )}
          >
            {mutation.isPending ? 'Saving…' : 'Create reservation'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
