'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface AssessmentType {
  id: string;
  name: string;
  isActive: boolean;
}

interface AssessmentSeries {
  id: string;
  name: string;
  isActive: boolean;
}

const emptyForm = {
  name: '',
  typeId: '',
  seriesId: '',
  totalMarks: '100',
};

export function CreateAssessmentDialog({
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
  const [form, setForm] = useState(emptyForm);

  const { data: types } = useQuery({
    queryKey: ['assessment-types', open],
    queryFn: () => apiClient<{ data: AssessmentType[] }>('/assessment-types', { token }),
    enabled: !!token && open,
  });

  const { data: seriesList } = useQuery({
    queryKey: ['assessment-series'],
    queryFn: () => apiClient<{ data: AssessmentSeries[] }>('/assessment-series', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) setForm(emptyForm);
  }, [open]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient('/assessments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId,
          name: form.name,
          typeId: form.typeId,
          totalMarks: Number(form.totalMarks),
          ...(form.seriesId ? { seriesId: form.seriesId } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success('Assessment created');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessmentsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = form.name.trim() && form.typeId && form.totalMarks && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <ClipboardList className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Create assessment</DialogTitle>
            <DialogDescription className="mt-1">Add a new test or exam for marks entry</DialogDescription>
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
            createMutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Name</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Assessment name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <FormFieldLabel required>Type</FormFieldLabel>
              <SelectDropdown
                aria-label="Assessment type"
                placeholder="Select type"
                value={form.typeId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, typeId: value }))}
                options={[
                  { value: '', label: 'Select type' },
                  ...(types?.data.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel>Series (optional)</FormFieldLabel>
              <SelectDropdown
                aria-label="Assessment series"
                placeholder="No series"
                value={form.seriesId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, seriesId: value }))}
                options={[
                  { value: '', label: 'No series' },
                  ...(seriesList?.data.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Total marks</FormFieldLabel>
              <input
                type="number"
                className={modalFieldClassName}
                placeholder="Total marks"
                value={form.totalMarks}
                onChange={(e) => setForm((prev) => ({ ...prev, totalMarks: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending ? 'Creating…' : 'Create assessment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
