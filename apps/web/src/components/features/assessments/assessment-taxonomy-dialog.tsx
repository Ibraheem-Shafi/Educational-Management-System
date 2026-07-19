'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodSchema } from 'zod';
import {
  createAssessmentSeriesSchema,
  createAssessmentTypeSchema,
  updateAssessmentSeriesSchema,
  updateAssessmentTypeSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

export type AssessmentTaxonomyKind = 'series' | 'types';

interface TaxonomyItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

const KIND_CONFIG: Record<
  AssessmentTaxonomyKind,
  { endpoint: string; queryKey: string; singular: string }
> = {
  series: { endpoint: '/assessment-series', queryKey: 'assessment-series', singular: 'series' },
  types: { endpoint: '/assessment-types', queryKey: 'assessment-types', singular: 'type' },
};

export function AssessmentTaxonomyDialog({
  open,
  onOpenChange,
  kind,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AssessmentTaxonomyKind;
  item?: TaxonomyItem | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const config = KIND_CONFIG[kind];
  const isEdit = Boolean(item);
  const schema = useMemo(
    () =>
      (kind === 'series'
        ? isEdit
          ? updateAssessmentSeriesSchema
          : createAssessmentSeriesSchema
        : isEdit
          ? updateAssessmentTypeSchema
          : createAssessmentTypeSchema) as ZodSchema<Record<string, unknown>>,
    [kind, isEdit],
  );

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(schema);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setCode(item?.code ?? '');
      setIsActive(item?.isActive ?? true);
    } else {
      clearAll();
    }
  }, [open, item, clearAll]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      isEdit && item
        ? apiClient(`${config.endpoint}/${item.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify(body),
          })
        : apiClient(config.endpoint, { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(isEdit ? `${title} updated` : `${title} created`);
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const title = kind === 'series' ? 'Series' : 'Type';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Layers className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>
              {isEdit ? `Edit ${config.singular}` : `Add ${config.singular}`}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {kind === 'series'
                ? 'Group assessments into a series (e.g. FLP-5)'
                : 'Categorise assessments by type (e.g. Midterm)'}
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
            const payload = {
              name: name.trim(),
              code: code.trim(),
              ...(isEdit ? { isActive } : {}),
            };
            if (!validate(payload)) return;
            mutation.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Name</FormFieldLabel>
              <input
                className={fieldClassName('name', modalFieldClassName)}
                placeholder={kind === 'series' ? 'FLP-5' : 'Midterm'}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearField('name');
                }}
              />
              <FormFieldError message={errors.name} />
            </div>
            <div>
              <FormFieldLabel required>Code</FormFieldLabel>
              <input
                className={fieldClassName('code', modalFieldClassName)}
                placeholder={kind === 'series' ? 'flp_5' : 'midterm'}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearField('code');
                }}
              />
              <FormFieldError message={errors.code} />
            </div>
            {isEdit && (
              <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            )}
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : `Add ${config.singular}`}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
