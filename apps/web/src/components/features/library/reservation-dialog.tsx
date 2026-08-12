'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { formatLabel } from './types';

function copySummary(book: LibraryBook): {
  total: number;
  available: number;
  activeReservations: number;
  queueSlotsLeft: number;
  canReserve: boolean;
  reason?: string;
} {
  const copies = book.copies ?? [];
  const total = copies.length;
  const available = copies.filter((c) => c.status === 'available').length;
  const activeReservations = book._count?.reservations ?? 0;
  const queueSlotsLeft = Math.max(0, total - activeReservations);

  if (total === 0) {
    return {
      total,
      available,
      activeReservations,
      queueSlotsLeft,
      canReserve: false,
      reason: 'No copies yet — add a copy first',
    };
  }
  if (available > 0) {
    return {
      total,
      available,
      activeReservations,
      queueSlotsLeft,
      canReserve: false,
      reason: 'Copy available — issue a loan instead',
    };
  }
  if (queueSlotsLeft <= 0) {
    return {
      total,
      available,
      activeReservations,
      queueSlotsLeft,
      canReserve: false,
      reason: 'Reservation queue is full for this title',
    };
  }
  return { total, available, activeReservations, queueSlotsLeft, canReserve: true };
}

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
    queryKey: queryKeys.libraryBooks(branchId, { limit: 100 }),
    queryFn: () =>
      apiClient<{ data: LibraryBook[] }>(
        `/library/books?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId && open,
  });

  const { data: studentsData } = useQuery({
    queryKey: queryKeys.students({ branchId, limit: 200 }),
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>(
        `/students/options?branchId=${branchId}&limit=200`,
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

  const books = booksData?.data ?? [];
  const selectedBook = useMemo(
    () => books.find((b) => b.id === bookId) ?? null,
    [books, bookId],
  );
  const selectedSummary = selectedBook ? copySummary(selectedBook) : null;

  const bookOptions = useMemo(
    () =>
      books.map((b) => {
        const summary = copySummary(b);
        const copyBits =
          summary.total === 0
            ? 'no copies'
            : `${summary.available}/${summary.total} available · ${summary.activeReservations} reserved`;
        return {
          value: b.id,
          label: `${b.title} — ${b.author} (${copyBits})`,
        };
      }),
    [books],
  );

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
      await queryClient.invalidateQueries({ queryKey: ['library-reservations', branchId] });
      await queryClient.invalidateQueries({ queryKey: ['library-books', branchId] });
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
    if (selectedSummary && !selectedSummary.canReserve) {
      toast.error(selectedSummary.reason ?? 'This book cannot be reserved right now');
      return;
    }
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
                options={bookOptions}
                className={fieldClassName('bookId', 'w-full')}
              />
              <FormFieldError message={errors.bookId} />
              {selectedBook && selectedSummary ? (
                <div className="mt-2 space-y-1 text-xs text-[var(--text-sub-500)]">
                  <p>
                    {selectedSummary.available}/{selectedSummary.total} copies available ·{' '}
                    {selectedSummary.activeReservations} active reservation
                    {selectedSummary.activeReservations === 1 ? '' : 's'} ·{' '}
                    {selectedSummary.queueSlotsLeft} queue slot
                    {selectedSummary.queueSlotsLeft === 1 ? '' : 's'} left
                  </p>
                  {(selectedBook.copies ?? []).length > 0 ? (
                    <p>
                      Copies:{' '}
                      {(selectedBook.copies ?? [])
                        .map((c) => `${c.copyCode} (${formatLabel(c.status)})`)
                        .join(', ')}
                    </p>
                  ) : null}
                  {selectedSummary.reason ? (
                    <p className="text-amber-700">{selectedSummary.reason}</p>
                  ) : (
                    <p className="text-emerald-700">Ready to reserve — all copies are currently out</p>
                  )}
                </div>
              ) : null}
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
            disabled={
              mutation.isPending || (!!selectedSummary && !selectedSummary.canReserve)
            }
            onClick={handleSave}
            className={cn(
              'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
              (mutation.isPending || (!!selectedSummary && !selectedSummary.canReserve)) &&
                'opacity-50',
            )}
          >
            {mutation.isPending ? 'Saving…' : 'Create reservation'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
