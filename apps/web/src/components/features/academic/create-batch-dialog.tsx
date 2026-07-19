'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, X } from 'lucide-react';
import { toast } from 'sonner';
import { createBatchSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import {
  SubjectChecklist,
  type SubjectOption,
} from '@/components/features/academic/subject-checklist';
import { cn } from '@/lib/utils';

function invalidateAcademic(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['programs'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
  queryClient.invalidateQueries({ queryKey: ['batches'] });
  queryClient.invalidateQueries({ queryKey: ['subjects'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
  queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
}

export function CreateBatchDialog({
  open,
  onOpenChange,
  branchId,
  programOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  programOptions: Array<{ value: string; label: string }>;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [programId, setProgramId] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createBatchSchema);

  const { data: subjects } = useQuery({
    queryKey: queryKeys.subjects,
    queryFn: () => apiClient<{ data: SubjectOption[] }>('/subjects', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setName('');
      setProgramId('');
      setSubjectIds([]);
      clearAll();
    }
  }, [open, clearAll]);

  const createBatch = useMutation({
    mutationFn: (body: {
      branchId: string;
      programId: string;
      name: string;
      subjectIds: string[];
    }) => apiClient('/batches', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Batch created');
      invalidateAcademic(queryClient);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Layers className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Add batch</DialogTitle>
            <DialogDescription className="mt-1">Create a batch and assign subjects</DialogDescription>
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
            const payload = {
              branchId,
              programId,
              name: name.trim(),
              subjectIds,
            };
            if (!validate(payload)) return;
            createBatch.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Program</FormFieldLabel>
              <SelectDropdown
                aria-label="Program"
                placeholder="Select program"
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value);
                  clearField('programId');
                }}
                options={[{ value: '', label: 'Select program' }, ...programOptions]}
                className={fieldClassName('programId', 'w-full')}
                fullWidth
              />
              <FormFieldError message={errors.programId} />
            </div>
            <div>
              <FormFieldLabel required>Batch name</FormFieldLabel>
              <input
                className={fieldClassName('name', modalFieldClassName)}
                placeholder="Batch name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearField('name');
                }}
              />
              <FormFieldError message={errors.name} />
            </div>
            <div>
              <FormFieldLabel>Subjects</FormFieldLabel>
              <SubjectChecklist
                subjects={subjects?.data ?? []}
                selectedIds={subjectIds}
                onChange={setSubjectIds}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createBatch.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createBatch.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createBatch.isPending ? 'Saving…' : 'Add batch'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
