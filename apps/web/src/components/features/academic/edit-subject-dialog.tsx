'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';

function invalidateAcademic(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['programs'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
  queryClient.invalidateQueries({ queryKey: ['batches'] });
  queryClient.invalidateQueries({ queryKey: ['subjects'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
  queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
}

export function EditSubjectDialog({
  open,
  onOpenChange,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: { id: string; name: string; code: string | null } | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!open || !subject) {
      setName('');
      setCode('');
      return;
    }
    setName(subject.name);
    setCode(subject.code ?? '');
  }, [open, subject]);

  const updateSubject = useMutation({
    mutationFn: () =>
      apiClient(`/subjects/${subject!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success('Subject updated');
      invalidateAcademic(queryClient);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = !!subject && name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <BookOpen className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Edit subject</DialogTitle>
            <DialogDescription className="mt-1">Update the subject name and code</DialogDescription>
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

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            updateSubject.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Subject name</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Subject name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div>
              <FormFieldLabel>Code</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Code (optional)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateSubject.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={updateSubject.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {updateSubject.isPending ? 'Saving…' : 'Save subject'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
