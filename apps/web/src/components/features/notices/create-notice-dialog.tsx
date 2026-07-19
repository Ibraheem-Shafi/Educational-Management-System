'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { createNoticeSchema, updateNoticeSchema } from '@eims/shared';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const emptyForm = {
  title: '',
  body: '',
  audience: 'all',
  publishAt: '',
};

export interface EditableNotice {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string | null;
  isPublished: boolean;
}

/** Convert an ISO timestamp to the value format used by `datetime-local` inputs. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolvePublishedAt(publishAt: string): string | null | undefined {
  const trimmed = publishAt.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function CreateNoticeDialog({
  open,
  onOpenChange,
  branchId,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  notice?: EditableNotice | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [pickedBranchId, setPickedBranchId] = useState('');
  const effectiveBranchId = branchId || pickedBranchId;
  const isEdit = Boolean(notice);
  const createFormErrors = useFormErrors(createNoticeSchema);
  const updateFormErrors = useFormErrors(updateNoticeSchema);
  const { errors, clearField, validate, applyApiErrors, fieldClassName, setFieldError, clearAll } =
    isEdit ? updateFormErrors : createFormErrors;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setPickedBranchId('');
      clearAll();
    } else if (notice) {
      setForm({
        title: notice.title,
        body: notice.body,
        audience: notice.audience,
        publishAt: notice.isPublished ? '' : toLocalInput(notice.publishedAt),
      });
    }
  }, [open, notice, clearAll]);

  const isScheduling = Boolean(form.publishAt.trim());

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (isEdit && notice) {
        return apiClient(`/notices/${notice.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
      }
      return apiClient('/notices', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Notice updated' : isScheduling ? 'Notice scheduled' : 'Notice created');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.noticesStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, isEdit ? updateFormErrors.applyApiErrors : createFormErrors.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(key === 'publishAt' ? 'publishedAt' : key);
    if (key === 'publishAt') clearField('publishAt');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const publishedAt = resolvePublishedAt(form.publishAt);
    if (form.publishAt.trim() && publishedAt === null) {
      setFieldError('publishAt', 'Enter a valid date');
      return;
    }
    if (publishedAt && new Date(publishedAt).getTime() <= Date.now()) {
      setFieldError('publishAt', 'Publish schedule must be in the future');
      return;
    }

    if (isEdit) {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        publishedAt: publishedAt ?? null,
      };
      if (!validate(payload)) return;
      createMutation.mutate(payload);
      return;
    }

    const payload = {
      branchId: effectiveBranchId,
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      ...(publishedAt ? { publishedAt } : {}),
    };
    if (!validate(payload)) return;
    createMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Megaphone className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit notice' : 'Create notice'}</DialogTitle>
            <DialogDescription className="mt-1">Draft an announcement for staff and portals</DialogDescription>
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
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
              <FormFieldLabel required>Title</FormFieldLabel>
              <input
                className={fieldClassName('title', modalFieldClassName)}
                placeholder="Title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
              />
              <FormFieldError message={errors.title} />
            </div>

            <div>
              <FormFieldLabel required>Body</FormFieldLabel>
              <textarea
                className={cn(fieldClassName('body', modalFieldClassName), 'min-h-[120px] resize-y py-3')}
                placeholder="Body"
                value={form.body}
                onChange={(e) => updateField('body', e.target.value)}
              />
              <FormFieldError message={errors.body} />
            </div>

            <div>
              <FormFieldLabel required>Audience</FormFieldLabel>
              <SelectDropdown
                aria-label="Audience"
                placeholder="Select audience"
                value={form.audience}
                onValueChange={(value) => updateField('audience', value)}
                options={[
                  { value: 'all', label: 'Everyone' },
                  { value: 'parents', label: 'Parents' },
                  { value: 'students', label: 'Students' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'teachers', label: 'Teachers' },
                ]}
                className="w-full"
              />
              <FormFieldError message={errors.audience} />
            </div>

            <div>
              <FormFieldLabel>Publish at</FormFieldLabel>
              <input
                type="datetime-local"
                className={fieldClassName('publishAt', modalFieldClassName)}
                value={form.publishAt}
                onChange={(e) => updateField('publishAt', e.target.value)}
                aria-label="Publish at"
              />
              <FormFieldError message={errors.publishAt ?? errors.publishedAt} />
              <p className="mt-1.5 text-xs text-[var(--text-sub-500,#525866)]">
                Leave empty to save as a draft. Set a future date to schedule publishing.
              </p>
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
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : isScheduling
                    ? 'Schedule notice'
                    : 'Save draft'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
