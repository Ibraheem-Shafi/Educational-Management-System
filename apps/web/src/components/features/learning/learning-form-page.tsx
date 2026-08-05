'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LEARNING_AUDIENCES,
  LEARNING_MEETING_PLATFORMS,
  LEARNING_RESOURCE_TYPES,
  LEARNING_VISIBILITY_SCOPES,
  createLearningResourceSchema,
  updateLearningResourceSchema,
} from '@eims/shared';
import type { LearningResourceResponse } from '@eims/types';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useBatches } from '@/hooks/use-batches';
import { useSubjectsOptions } from '@/hooks/use-subjects-options';
import { usePageBranchScopeOptional } from '@/hooks/use-page-branch-scope';
import { useFormErrors } from '@/hooks/use-form-errors';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { DateField } from '@/components/ui/date-field';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface Program {
  id: string;
  name: string;
}

export function LearningFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const editId = mode === 'edit' ? params?.id : undefined;
  const pageScope = usePageBranchScopeOptional();
  const [pickedBranchId, setPickedBranchId] = useState('');
  const scopedSingleBranchId = pageScope?.singleBranchId ?? null;

  const { data: existing } = useQuery({
    queryKey: ['learning', 'detail', editId],
    queryFn: () => apiClient<LearningResourceResponse>(`/learning/${editId}`, { token }),
    enabled: !!token && !!editId,
  });

  // Edit: locked to the resource's branch. Create: assigned branch, then
  // explicit pick / single-branch scope (no first-branch fallback).
  const effectiveBranchId =
    mode === 'edit'
      ? (existing?.branchId ?? '')
      : user?.branchId || pickedBranchId || scopedSingleBranchId || '';

  const [title, setTitle] = useState('');
  const [type, setType] = useState('homework');
  const [visibilityScope, setVisibilityScope] = useState('batch');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [audience, setAudience] = useState('students');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [fileName, setFileName] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState('meet');

  useEffect(() => {
    if (!existing || mode !== 'edit') return;
    setTitle(existing.title ?? '');
    setType(existing.type);
    setVisibilityScope(existing.visibilityScope);
    setProgramId(existing.programId ?? '');
    setBatchId(existing.batchId ?? '');
    setSubjectId(existing.subjectId ?? '');
    setAudience(existing.audience ?? 'students');
    setDescription(existing.description ?? '');
    setBody(existing.body ?? '');
    setDueAt(existing.dueAt ? existing.dueAt.slice(0, 16) : '');
    setMaxMarks(existing.maxMarks ? String(existing.maxMarks) : '');
    setIsPublished(existing.isPublished);
    setFileName(existing.attachments?.[0]?.fileName ?? '');
    setStoragePath(existing.attachments?.[0]?.storagePath ?? '');
    setStartsAt(existing.startsAt ? existing.startsAt.slice(0, 16) : '');
    setEndsAt(existing.endsAt ? existing.endsAt.slice(0, 16) : '');
    setMeetingUrl(existing.meetingUrl ?? '');
    setMeetingPlatform(existing.meetingPlatform ?? 'meet');
  }, [existing, mode]);

  const { data: programs } = useQuery({
    queryKey: ['programs', effectiveBranchId],
    queryFn: () => apiClient<{ data: Program[] }>(`/programs/options?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: batches } = useBatches(token, effectiveBranchId, programId || undefined, !!effectiveBranchId);

  const { data: subjects } = useSubjectsOptions(token);

  const requiresProgram = visibilityScope === 'program';
  const requiresBatch = visibilityScope === 'batch' || visibilityScope === 'batch_subject';
  const requiresSubject = visibilityScope === 'batch_subject';

  const isOnlineClass = type === 'online_class';
  const learningSchema = editId ? updateLearningResourceSchema : createLearningResourceSchema;
  const { errors, clearField, validate, applyApiErrors, fieldClassName } = useFormErrors(learningSchema);

  const buildPayload = () => ({
    ...(editId ? {} : { branchId: effectiveBranchId }),
    title: title.trim(),
    type,
    visibilityScope,
    programId: programId || null,
    batchId: batchId || null,
    subjectId: subjectId || null,
    audience,
    description: description.trim() || undefined,
    body: body.trim() || undefined,
    dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    maxMarks: maxMarks ? Number(maxMarks) : null,
    startsAt: isOnlineClass && startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: isOnlineClass && endsAt ? new Date(endsAt).toISOString() : null,
    meetingUrl: isOnlineClass ? meetingUrl.trim() || null : null,
    meetingPlatform: isOnlineClass ? meetingPlatform : null,
    isPublished,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const path = editId ? `/learning/${editId}` : '/learning';
      const method = editId ? 'PATCH' : 'POST';
      const resource = await apiClient<LearningResourceResponse>(path, {
        method,
        token,
        body: JSON.stringify(payload),
      });
      if (fileName.trim() && storagePath.trim()) {
        await apiClient(`/learning/${resource.id}/attachments`, {
          method: 'POST',
          token,
          body: JSON.stringify({ fileName: fileName.trim(), storagePath: storagePath.trim() }),
        });
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Learning content updated' : 'Learning content created');
      queryClient.invalidateQueries({ queryKey: queryKeys.learning() });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningStats });
      router.push('/dashboard/learning');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="text-sm text-text-sub-500">
        <Link href="/dashboard/learning" className="hover:underline">
          Dashboard
        </Link>{' '}
        /{' '}
        <Link href="/dashboard/learning" className="hover:underline">
          Learning
        </Link>{' '}
        / <span className="text-text-main-900">{editId ? 'Edit content' : 'New content'}</span>
      </div>

      <ContentPanel
        title={editId ? 'Edit learning content' : 'Create learning content'}
        actions={
          <button
            type="button"
            onClick={() => router.push('/dashboard/learning')}
            className="rounded-md border border-stroke-soft-200 px-3 py-1.5 text-sm text-text-sub-500 hover:bg-neutral-50"
          >
            Back
          </button>
        }
      >
        <form
          className="space-y-6 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = buildPayload();
            if (!validate(payload)) return;
            submitMutation.mutate(payload);
          }}
        >
          {mode === 'create' && !user?.branchId && (
            <BranchSelectField
              value={pickedBranchId || scopedSingleBranchId || ''}
              onValueChange={(value) => {
                setPickedBranchId(value);
                setProgramId('');
                setBatchId('');
                clearField('branchId');
              }}
              error={errors.branchId}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FormFieldLabel required>Title</FormFieldLabel>
              <input
                className={fieldClassName('title', modalFieldClassName)}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearField('title');
                }}
              />
              <FormFieldError message={errors.title} />
            </div>
            <div>
              <FormFieldLabel required>Type</FormFieldLabel>
              <SelectDropdown
                aria-label="Type"
                value={type}
                onValueChange={setType}
                options={LEARNING_RESOURCE_TYPES.map((v) => ({ value: v, label: v.replace('_', ' ') }))}
                className="w-full"
              />
            </div>
            <div>
              <FormFieldLabel required>Visibility scope</FormFieldLabel>
              <SelectDropdown
                aria-label="Visibility scope"
                value={visibilityScope}
                onValueChange={setVisibilityScope}
                options={LEARNING_VISIBILITY_SCOPES.map((v) => ({ value: v, label: v.replace('_', ' ') }))}
                className="w-full"
              />
            </div>
            <div>
              <FormFieldLabel required>Audience</FormFieldLabel>
              <SelectDropdown
                aria-label="Audience"
                value={audience}
                onValueChange={setAudience}
                options={LEARNING_AUDIENCES.map((v) => ({ value: v, label: v }))}
                className="w-full"
              />
            </div>
            <div>
              <FormFieldLabel required={requiresProgram || requiresBatch || requiresSubject}>Program</FormFieldLabel>
              <SelectDropdown
                aria-label="Program"
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value);
                  setBatchId('');
                  setSubjectId('');
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
                value={batchId}
                onValueChange={(value) => {
                  setBatchId(value);
                  setSubjectId('');
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
                value={subjectId}
                onValueChange={(value) => {
                  setSubjectId(value);
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
            {isOnlineClass ? (
              <>
                <div>
                  <FormFieldLabel required>Starts at</FormFieldLabel>
                  <DateField
                    type="datetime-local"
                    className={fieldClassName('startsAt', modalFieldClassName)}
                    value={startsAt}
                    onValueChange={(next) => {
                      setStartsAt(next);
                      clearField('startsAt');
                    }}
                  />
                  <FormFieldError message={errors.startsAt} />
                </div>
                <div>
                  <FormFieldLabel>Ends at</FormFieldLabel>
                  <DateField
                    type="datetime-local"
                    className={fieldClassName('endsAt', modalFieldClassName)}
                    value={endsAt}
                    onValueChange={(next) => {
                      setEndsAt(next);
                      clearField('endsAt');
                    }}
                  />
                  <FormFieldError message={errors.endsAt} />
                </div>
                <div>
                  <FormFieldLabel required>Meeting URL</FormFieldLabel>
                  <input
                    type="url"
                    className={fieldClassName('meetingUrl', modalFieldClassName)}
                    value={meetingUrl}
                    onChange={(e) => {
                      setMeetingUrl(e.target.value);
                      clearField('meetingUrl');
                    }}
                    placeholder="https://meet.google.com/..."
                  />
                  <FormFieldError message={errors.meetingUrl} />
                </div>
                <div>
                  <FormFieldLabel>Meeting platform</FormFieldLabel>
                  <SelectDropdown
                    aria-label="Meeting platform"
                    value={meetingPlatform}
                    onValueChange={setMeetingPlatform}
                    options={LEARNING_MEETING_PLATFORMS.map((v) => ({
                      value: v,
                      label: v.charAt(0).toUpperCase() + v.slice(1),
                    }))}
                    className="w-full"
                  />
                </div>
              </>
            ) : (
              <div>
                <FormFieldLabel>Due at</FormFieldLabel>
                <DateField
                  type="datetime-local"
                  className={modalFieldClassName}
                  value={dueAt}
                  onValueChange={setDueAt}
                />
              </div>
            )}
            <div>
              <FormFieldLabel>Max marks</FormFieldLabel>
              <input
                type="number"
                className={modalFieldClassName}
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div>
              <FormFieldLabel>Attachment filename</FormFieldLabel>
              <input className={modalFieldClassName} value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </div>
            <div>
              <FormFieldLabel>Attachment storage path</FormFieldLabel>
              <input
                className={modalFieldClassName}
                value={storagePath}
                onChange={(e) => setStoragePath(e.target.value)}
                placeholder="storage://..."
              />
            </div>
          </div>

          <div>
            <FormFieldLabel>Description</FormFieldLabel>
            <textarea
              className={cn(modalFieldClassName, 'min-h-[90px] resize-y py-3')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <FormFieldLabel>Body</FormFieldLabel>
            <textarea
              className={cn(modalFieldClassName, 'min-h-[220px] resize-y py-3')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-main-900">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            Publish immediately
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/learning')}
              className="rounded-[10px] border border-stroke-soft-200 px-4 py-2 text-sm text-text-sub-500 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Saving…' : editId ? 'Save changes' : 'Create content'}
            </button>
          </div>
        </form>
      </ContentPanel>
    </div>
  );
}
