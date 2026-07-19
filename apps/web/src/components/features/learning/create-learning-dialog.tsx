'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, X } from 'lucide-react';
import { LEARNING_AUDIENCES, LEARNING_RESOURCE_TYPES, LEARNING_VISIBILITY_SCOPES, createLearningResourceSchema, updateLearningResourceSchema } from '@eims/shared';
import type { LearningResourceResponse } from '@eims/types';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useBatches } from '@/hooks/use-batches';
import { useFormErrors } from '@/hooks/use-form-errors';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface Program {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

const quickTypes = LEARNING_RESOURCE_TYPES.filter((t) => t === 'note' || t === 'material' || t === 'resource');

const emptyForm = {
  title: '',
  type: 'note',
  visibilityScope: 'branch',
  programId: '',
  batchId: '',
  subjectId: '',
  audience: 'all',
  description: '',
  body: '',
  isPublished: false,
  fileName: '',
  storagePath: '',
};

type FormState = typeof emptyForm;

function toForm(resource: LearningResourceResponse): FormState {
  const firstAttachment = resource.attachments?.[0];
  return {
    title: resource.title ?? '',
    type: resource.type,
    visibilityScope: resource.visibilityScope,
    programId: resource.programId ?? '',
    batchId: resource.batchId ?? '',
    subjectId: resource.subjectId ?? '',
    audience: resource.audience ?? 'all',
    description: resource.description ?? '',
    body: resource.body ?? '',
    isPublished: resource.isPublished,
    fileName: firstAttachment?.fileName ?? '',
    storagePath: firstAttachment?.storagePath ?? '',
  };
}

export function CreateLearningDialog({
  open,
  onOpenChange,
  branchId,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  resource?: LearningResourceResponse | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pickedBranchId, setPickedBranchId] = useState('');
  const effectiveBranchId = (resource ? resource.branchId : branchId) || pickedBranchId;

  useEffect(() => {
    if (!open) return;
    setForm(resource ? toForm(resource) : emptyForm);
  }, [open, resource]);

  useEffect(() => {
    if (!open) setPickedBranchId('');
  }, [open]);

  const { data: programs } = useQuery({
    queryKey: ['programs', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Program[] }>(`/programs?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId && open,
  });

  const { data: batches } = useBatches(token, effectiveBranchId, form.programId || undefined, open);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: Subject[] }>('/subjects', { token }),
    enabled: !!token && open,
  });

  const requiresProgram = form.visibilityScope === 'program';
  const requiresBatch = form.visibilityScope === 'batch' || form.visibilityScope === 'batch_subject';
  const requiresSubject = form.visibilityScope === 'batch_subject';
  const learningSchema = resource ? updateLearningResourceSchema : createLearningResourceSchema;
  const { errors, clearField, validate, applyApiErrors, fieldClassName, clearAll } =
    useFormErrors(learningSchema);

  useEffect(() => {
    if (!open) {
      clearAll();
    }
  }, [open, clearAll]);

  const buildPayload = () => ({
    ...(resource ? {} : { branchId: effectiveBranchId }),
    title: form.title.trim(),
    type: form.type,
    visibilityScope: form.visibilityScope,
    audience: form.audience,
    description: form.description.trim() || undefined,
    body: form.body.trim() || undefined,
    isPublished: form.isPublished,
    programId: form.programId || null,
    batchId: form.batchId || null,
    subjectId: form.subjectId || null,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const method = resource ? 'PATCH' : 'POST';
      const path = resource ? `/learning/${resource.id}` : '/learning';
      const saved = await apiClient<LearningResourceResponse>(path, {
        method,
        token,
        body: JSON.stringify(payload),
      });
      if (form.fileName.trim() && form.storagePath.trim()) {
        await apiClient(`/learning/${saved.id}/attachments`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            fileName: form.fileName.trim(),
            storagePath: form.storagePath.trim(),
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(resource ? 'Content updated' : 'Content created');
      queryClient.invalidateQueries({ queryKey: queryKeys.learning() });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const updateFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(String(key));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <BookMarked className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{resource ? 'Edit content' : 'Create content'}</DialogTitle>
            <DialogDescription className="mt-1">
              Quick publish for notes, materials and resources
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
            const payload = buildPayload();
            if (!validate(payload)) return;
            upsertMutation.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="rounded-lg border border-stroke-soft-200 bg-neutral-50 px-3 py-2 text-xs text-text-sub-500">
              For homework/syllabus, use{' '}
              <Link href="/dashboard/learning/new" className="text-[var(--institution-primary)] underline">
                full form
              </Link>
              .
            </div>
            {!resource && !branchId && (
              <BranchSelectField
                value={pickedBranchId}
                onValueChange={(value) => {
                  clearField('branchId');
                  setPickedBranchId(value);
                  setForm((prev) => ({ ...prev, programId: '', batchId: '', subjectId: '' }));
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
                onChange={(e) => updateFormField('title', e.target.value)}
              />
              <FormFieldError message={errors.title} />
            </div>

            <div>
              <FormFieldLabel required>Type</FormFieldLabel>
              <SelectDropdown
                aria-label="Type"
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                options={quickTypes.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Visibility scope</FormFieldLabel>
              <SelectDropdown
                aria-label="Visibility scope"
                value={form.visibilityScope}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    visibilityScope: value,
                    ...(value === 'branch' ? { programId: '', batchId: '', subjectId: '' } : {}),
                    ...(value === 'program' ? { batchId: '', subjectId: '' } : {}),
                    ...(value === 'batch' ? { subjectId: '' } : {}),
                  }))
                }
                options={LEARNING_VISIBILITY_SCOPES.map((v) => ({
                  value: v,
                  label: v.replace('_', ' '),
                }))}
                className="w-full"
              />
            </div>

            {(requiresProgram || requiresBatch || requiresSubject) && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <FormFieldLabel required={requiresProgram || requiresBatch || requiresSubject}>
                    Program
                  </FormFieldLabel>
                  <SelectDropdown
                    aria-label="Program"
                    value={form.programId}
                    onValueChange={(value) => {
                      setForm((prev) => ({ ...prev, programId: value, batchId: '', subjectId: '' }));
                      clearField('programId');
                    }}
                    options={[
                      { value: '', label: 'Select program' },
                      ...(programs?.data.map((p) => ({ value: p.id, label: p.name })) ?? []),
                    ]}
                    className="w-full"
                  />
                  <FormFieldError message={errors.programId} />
                </div>
                <div>
                  <FormFieldLabel required={requiresBatch || requiresSubject}>Batch</FormFieldLabel>
                  <SelectDropdown
                    aria-label="Batch"
                    value={form.batchId}
                    onValueChange={(value) => {
                      setForm((prev) => ({ ...prev, batchId: value, subjectId: '' }));
                      clearField('batchId');
                    }}
                    options={[
                      { value: '', label: 'Select batch' },
                      ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                    ]}
                    className="w-full"
                  />
                  <FormFieldError message={errors.batchId} />
                </div>
                <div>
                  <FormFieldLabel required={requiresSubject}>Subject</FormFieldLabel>
                  <SelectDropdown
                    aria-label="Subject"
                    value={form.subjectId}
                    onValueChange={(value) => {
                      setForm((prev) => ({ ...prev, subjectId: value }));
                      clearField('subjectId');
                    }}
                    options={[
                      { value: '', label: 'Select subject' },
                      ...(subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? []),
                    ]}
                    className="w-full"
                  />
                  <FormFieldError message={errors.subjectId} />
                </div>
              </div>
            )}

            <div>
              <FormFieldLabel required>Audience</FormFieldLabel>
              <SelectDropdown
                aria-label="Audience"
                value={form.audience}
                onValueChange={(value) => setForm((prev) => ({ ...prev, audience: value }))}
                options={LEARNING_AUDIENCES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel>Description</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[80px] resize-y py-3')}
                placeholder="Optional summary"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <FormFieldLabel>Body</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[120px] resize-y py-3')}
                placeholder="Content"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Attachment filename</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Optional"
                  value={form.fileName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fileName: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel>Attachment storage path</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="storage://..."
                  value={form.storagePath}
                  onChange={(e) => setForm((prev) => ({ ...prev, storagePath: e.target.value }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-text-main-900">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
              />
              Publish immediately
            </label>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={upsertMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsertMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {upsertMutation.isPending ? 'Saving…' : resource ? 'Save changes' : 'Create content'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
