'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, X } from 'lucide-react';
import { toast } from 'sonner';
import { issueLibraryLoanSchema } from '@eims/shared';
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

export function IssueLoanDialog({
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

  const [borrowerType, setBorrowerType] = useState<'student' | 'user'>('student');
  const [studentId, setStudentId] = useState('');
  const [copyId, setCopyId] = useState('');

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(issueLibraryLoanSchema);

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
        `/students/options?branchId=${branchId}&limit=200`,
        { token },
      ),
    enabled: !!token && !!branchId && open && borrowerType === 'student',
  });

  const availableCopies =
    booksData?.data.flatMap((book) =>
      (book.copies ?? [])
        .filter((c) => c.status === 'available')
        .map((c) => ({
          value: c.id,
          label: `${book.title} — ${c.copyCode}`,
        })),
    ) ?? [];

  useEffect(() => {
    if (!open) {
      setBorrowerType('student');
      setStudentId('');
      setCopyId('');
      clearAll();
    }
  }, [open, clearAll]);

  const buildPayload = () => ({
    branchId,
    copyId,
    borrowerType,
    ...(borrowerType === 'student' ? { studentId } : {}),
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/library/loans/issue', {
        method: 'POST',
        token,
        body: payload,
      }),
    onSuccess: async () => {
      toast.success('Book issued');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryLoans(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryBooks(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to issue book');
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
            <BookMarked className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Issue book</DialogTitle>
            <DialogDescription className="sr-only">Issue an available copy to a borrower</DialogDescription>
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
              <FormFieldLabel htmlFor="issue-copy">Available copy</FormFieldLabel>
              <SelectDropdown
                aria-label="Copy"
                placeholder="Select copy"
                value={copyId}
                onValueChange={(value) => {
                  setCopyId(value);
                  clearField('copyId');
                }}
                options={availableCopies}
                className={fieldClassName('copyId', 'w-full')}
              />
              <FormFieldError message={errors.copyId} />
            </div>
            <div>
              <FormFieldLabel htmlFor="borrower-type">Borrower type</FormFieldLabel>
              <SelectDropdown
                aria-label="Borrower type"
                value={borrowerType}
                onValueChange={(v) => {
                  setBorrowerType(v as 'student' | 'user');
                  clearField('borrowerType');
                  clearField('studentId');
                  clearField('userId');
                }}
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'user', label: 'Staff' },
                ]}
                className={fieldClassName('borrowerType', 'w-full')}
              />
              <FormFieldError message={errors.borrowerType} />
            </div>
            {borrowerType === 'student' && (
              <div>
                <FormFieldLabel htmlFor="issue-student">Student</FormFieldLabel>
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
            )}
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
            {mutation.isPending ? 'Issuing…' : 'Issue book'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
