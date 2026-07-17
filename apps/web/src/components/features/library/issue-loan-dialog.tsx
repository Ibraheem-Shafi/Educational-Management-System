'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, X } from 'lucide-react';
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
import { SelectDropdown } from '@/components/layout/select-dropdown';
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
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!copyId) throw new Error('Select a copy');
      if (borrowerType === 'student' && !studentId) throw new Error('Select a student');
      return apiClient('/library/loans/issue', {
        method: 'POST',
        token,
        body: {
          branchId,
          copyId,
          borrowerType,
          ...(borrowerType === 'student' ? { studentId } : {}),
        },
      });
    },
    onSuccess: async () => {
      toast.success('Book issued');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryLoans(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryBooks(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Unable to issue book'),
  });

  const canSubmit =
    !!copyId && (borrowerType === 'student' ? !!studentId : true) && !!branchId;

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
                onValueChange={setCopyId}
                options={availableCopies}
                className="w-full"
              />
            </div>
            <div>
              <FormFieldLabel htmlFor="borrower-type">Borrower type</FormFieldLabel>
              <SelectDropdown
                aria-label="Borrower type"
                value={borrowerType}
                onValueChange={(v) => setBorrowerType(v as 'student' | 'user')}
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'user', label: 'Staff' },
                ]}
                className="w-full"
              />
            </div>
            {borrowerType === 'student' && (
              <div>
                <FormFieldLabel htmlFor="issue-student">Student</FormFieldLabel>
                <SelectDropdown
                  aria-label="Student"
                  placeholder="Select student"
                  value={studentId}
                  onValueChange={setStudentId}
                  options={(studentsData?.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.fullName,
                  }))}
                  className="w-full"
                />
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
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className={cn(
              'rounded-lg bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm font-medium text-white',
              (!canSubmit || mutation.isPending) && 'opacity-50',
            )}
          >
            {mutation.isPending ? 'Issuing…' : 'Issue book'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
