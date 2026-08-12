'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LEARNING_AUDIENCES,
  LEARNING_RESOURCE_TYPES,
  LEARNING_VISIBILITY_SCOPES,
  createLearningResourceSchema,
  updateLearningResourceSchema,
} from '@eims/shared';
import type { LearningAttachmentResponse, LearningResourceResponse } from '@eims/types';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadLearningContent } from '@/lib/upload-learning-content';
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
import { LearningAttachmentsField } from '@/components/features/learning/learning-attachments-field';
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
  const [existingAttachments, setExistingAttachments] = useState<LearningAttachmentResponse[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<Set<string>>(() => new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
    setExistingAttachments(existing.attachments ?? []);
    setRemovedAttachmentIds(new Set());
    setPendingFiles([]);
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
    meetingUrl: meetingUrl.trim() || null,
    meetingPlatform: meetingUrl.trim()
      ? isOnlineClass
        ? meetingPlatform
        : meetingPlatform || 'other'
      : null,
    isPublished,
  });

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!token || !editId) return;
    setDownloadingId(attachmentId);
    try {
      const res = await apiClient<{ url: string }>(
        `/learning/${editId}/attachments/${attachmentId}/signed-url`,
        { token },
      );
      const anchor = document.createElement('a');
      anchor.href = res.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error('Unable to download attachment');
    } finally {
      setDownloadingId(null);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const path = editId ? `/learning/${editId}` : '/learning';
      const method = editId ? 'PATCH' : 'POST';
      const resource = await apiClient<LearningResourceResponse>(path, {
        method,
        token,
        body: JSON.stringify(payload),
      });

      for (const attachmentId of removedAttachmentIds) {
        await apiClient(`/learning/${resource.id}/attachments/${attachmentId}`, {
          method: 'DELETE',
          token,
        });
      }

      for (const file of pendingFiles) {
        const uploaded = await uploadLearningContent(file, resource.id, token!);
        await apiClient(`/learning/${resource.id}/attachments`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            fileName: uploaded.fileName,
            storagePath: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          }),
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
          noValidate
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
                onValueChange={(value) => {
                  setType(value);
                  if (value === 'online_class') {
                    setMeetingPlatform((prev) => (prev === 'other' || !prev ? 'meet' : prev));
                  } else if (meetingUrl) {
                    setMeetingPlatform('other');
                  }
                }}
                options={LEARNING_RESOURCE_TYPES.map((v) => ({
                  value: v,
                  label:
                    v === 'online_class'
                      ? 'Live video class'
                      : v.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()),
                }))}
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
                    min={startsAt || undefined}
                    onValueChange={(next) => {
                      setEndsAt(next);
                      clearField('endsAt');
                    }}
                  />
                  <FormFieldError message={errors.endsAt} />
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
          </div>

          {isOnlineClass ? (
            <div className="space-y-4 rounded-xl border border-stroke-soft-200 bg-neutral-50 p-4">
              <div>
                <p className="text-sm font-medium text-text-main-900">Live video class</p>
                <p className="mt-1 text-xs text-text-sub-500">
                  Share the Zoom, Google Meet, or Teams link students will use to join.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FormFieldLabel required>Meeting / video call URL</FormFieldLabel>
                  <input
                    type="url"
                    className={fieldClassName('meetingUrl', modalFieldClassName)}
                    value={meetingUrl}
                    onChange={(e) => {
                      setMeetingUrl(e.target.value);
                      clearField('meetingUrl');
                    }}
                    placeholder="https://meet.google.com/… or https://zoom.us/j/…"
                  />
                  <FormFieldError message={errors.meetingUrl} />
                </div>
                <div>
                  <FormFieldLabel>Platform</FormFieldLabel>
                  <SelectDropdown
                    aria-label="Meeting platform"
                    value={meetingPlatform}
                    onValueChange={setMeetingPlatform}
                    options={[
                      { value: 'meet', label: 'Google Meet' },
                      { value: 'zoom', label: 'Zoom' },
                      { value: 'teams', label: 'Microsoft Teams' },
                      { value: 'other', label: 'Other' },
                    ]}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-stroke-soft-200 p-4">
              <div>
                <p className="text-sm font-medium text-text-main-900">Video link (optional)</p>
                <p className="mt-1 text-xs text-text-sub-500">
                  Add a YouTube, Vimeo, Drive, or recorded class link. You can also upload video files
                  below as attachments.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FormFieldLabel>Video / recording URL</FormFieldLabel>
                  <input
                    type="url"
                    className={fieldClassName('meetingUrl', modalFieldClassName)}
                    value={meetingUrl}
                    onChange={(e) => {
                      setMeetingUrl(e.target.value);
                      if (e.target.value.trim()) setMeetingPlatform('other');
                      clearField('meetingUrl');
                    }}
                    placeholder="https://youtube.com/watch?v=… or Drive link"
                  />
                  <FormFieldError message={errors.meetingUrl} />
                </div>
              </div>
            </div>
          )}

          <LearningAttachmentsField
            existing={existingAttachments}
            removedIds={removedAttachmentIds}
            pendingFiles={pendingFiles}
            disabled={submitMutation.isPending}
            downloadingId={downloadingId}
            onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
            onRemovePending={(index) =>
              setPendingFiles((prev) => prev.filter((_, i) => i !== index))
            }
            onRemoveExisting={(id) =>
              setRemovedAttachmentIds((prev) => new Set(prev).add(id))
            }
            onDownloadExisting={editId ? downloadAttachment : undefined}
          />

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
