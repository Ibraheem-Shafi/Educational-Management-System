'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodSchema } from 'zod';
import { createAssessmentSchema, updateAssessmentSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { BranchSelectField } from '@/components/forms/branch-select-field';
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

interface AssessmentFormData {
  id: string;
  name: string;
  typeId: string;
  seriesId: string | null;
  totalMarks: number;
  answerKey: string | null;
  reviewNotes: string | null;
}

const emptyForm = {
  name: '',
  typeId: '',
  seriesId: '',
  totalMarks: '100',
  answerKey: '',
  reviewNotes: '',
};

export function CreateAssessmentDialog({
  open,
  onOpenChange,
  branchId,
  assessment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  assessment?: AssessmentFormData | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(assessment);
  const [form, setForm] = useState(emptyForm);
  const [pickedBranchId, setPickedBranchId] = useState('');
  const effectiveBranchId = branchId || pickedBranchId;
  const assessmentSchema = useMemo(
    () =>
      (isEdit ? updateAssessmentSchema : createAssessmentSchema) as ZodSchema<
        Record<string, unknown>
      >,
    [isEdit],
  );
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(assessmentSchema);

  const { data: types } = useQuery({
    queryKey: ['assessment-types', open],
    queryFn: () => apiClient<{ data: AssessmentType[] }>('/assessment-types?limit=100', { token }),
    enabled: !!token && open,
  });

  const { data: seriesList } = useQuery({
    queryKey: ['assessment-series'],
    queryFn: () => apiClient<{ data: AssessmentSeries[] }>('/assessment-series?limit=100', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setPickedBranchId('');
      clearAll();
      return;
    }
    if (assessment) {
      setForm({
        name: assessment.name,
        typeId: assessment.typeId,
        seriesId: assessment.seriesId ?? '',
        totalMarks: String(assessment.totalMarks),
        answerKey: assessment.answerKey ?? '',
        reviewNotes: assessment.reviewNotes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, assessment, clearAll]);

  const buildCreatePayload = () => ({
    branchId: effectiveBranchId,
    name: form.name.trim(),
    typeId: form.typeId,
    totalMarks: Number(form.totalMarks),
    ...(form.seriesId ? { seriesId: form.seriesId } : {}),
    ...(form.answerKey.trim() ? { answerKey: form.answerKey.trim() } : {}),
    ...(form.reviewNotes.trim() ? { reviewNotes: form.reviewNotes.trim() } : {}),
  });

  const buildUpdatePayload = () => ({
    name: form.name.trim(),
    typeId: form.typeId,
    totalMarks: Number(form.totalMarks),
    seriesId: form.seriesId || null,
    answerKey: form.answerKey.trim() || null,
    reviewNotes: form.reviewNotes.trim() || null,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/assessments', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Assessment created');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessmentsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient(`/assessments/${assessment!.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Assessment updated');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <ClipboardList className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit assessment' : 'Create assessment'}</DialogTitle>
            <DialogDescription className="mt-1">
              {isEdit ? 'Update assessment details and answer key' : 'Add a new test or exam for marks entry'}
            </DialogDescription>
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
            if (isEdit) {
              const payload = buildUpdatePayload();
              if (!validate(payload)) return;
              updateMutation.mutate(payload);
            } else {
              const payload = buildCreatePayload();
              if (!validate(payload)) return;
              createMutation.mutate(payload);
            }
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {!isEdit && !branchId && (
              <BranchSelectField
                value={pickedBranchId}
                onValueChange={(value) => {
                  clearField('branchId');
                  setPickedBranchId(value);
                }}
                error={errors.branchId}
              />
            )}

            <div>
              <FormFieldLabel required>Name</FormFieldLabel>
              <input
                className={fieldClassName('name', modalFieldClassName)}
                placeholder="Assessment name"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  clearField('name');
                }}
              />
              <FormFieldError message={errors.name} />
            </div>

            <div>
              <FormFieldLabel required>Type</FormFieldLabel>
              <SelectDropdown
                aria-label="Assessment type"
                placeholder="Select type"
                value={form.typeId}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, typeId: value }));
                  clearField('typeId');
                }}
                options={[
                  { value: '', label: 'Select type' },
                  ...(types?.data.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })) ?? []),
                ]}
                className={fieldClassName('typeId', 'w-full')}
              />
              <FormFieldError message={errors.typeId} />
            </div>

            <div>
              <FormFieldLabel>Series (optional)</FormFieldLabel>
              <SelectDropdown
                aria-label="Assessment series"
                placeholder="No series"
                value={form.seriesId}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, seriesId: value }));
                  clearField('seriesId');
                }}
                options={[
                  { value: '', label: 'No series' },
                  ...(seriesList?.data.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })) ?? []),
                ]}
                className={fieldClassName('seriesId', 'w-full')}
              />
              <FormFieldError message={errors.seriesId} />
            </div>

            <div>
              <FormFieldLabel required>Total marks</FormFieldLabel>
              <input
                type="number"
                className={fieldClassName('totalMarks', modalFieldClassName)}
                placeholder="Total marks"
                value={form.totalMarks}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, totalMarks: e.target.value }));
                  clearField('totalMarks');
                }}
              />
              <FormFieldError message={errors.totalMarks} />
            </div>

            <div>
              <FormFieldLabel>Answer key (optional)</FormFieldLabel>
              <textarea
                className={cn(fieldClassName('answerKey', modalFieldClassName), 'min-h-[120px] resize-y')}
                placeholder="Answer key or marking scheme"
                value={form.answerKey}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, answerKey: e.target.value }));
                  clearField('answerKey');
                }}
              />
              <FormFieldError message={errors.answerKey} />
            </div>

            {isEdit && (
              <div>
                <FormFieldLabel>Review notes (optional)</FormFieldLabel>
                <textarea
                  className={cn(fieldClassName('reviewNotes', modalFieldClassName), 'min-h-[80px] resize-y')}
                  placeholder="Internal review notes"
                  value={form.reviewNotes}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, reviewNotes: e.target.value }));
                    clearField('reviewNotes');
                  }}
                />
                <FormFieldError message={errors.reviewNotes} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create assessment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
