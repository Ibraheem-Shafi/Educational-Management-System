'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodSchema } from 'zod';
import { createProgramSchema, updateProgramSchema } from '@eims/shared';
import type { ProgramDetailResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePageBranchScopeOptional } from '@/hooks/use-page-branch-scope';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
} from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import {
  SubjectChecklist,
  type SubjectOption,
} from '@/components/features/academic/subject-checklist';

interface Branch {
  id: string;
  name: string;
}

interface DraftBatch {
  key: string;
  id?: string;
  name: string;
  subjectIds: string[];
}

function newDraftBatch(): DraftBatch {
  return {
    key: `new-${crypto.randomUUID()}`,
    name: '',
    subjectIds: [],
  };
}

function invalidateAcademic(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['programs'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
  queryClient.invalidateQueries({ queryKey: ['batches'] });
  queryClient.invalidateQueries({ queryKey: ['subjects'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
  queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
}

export function ProgramForm({
  mode,
  programId,
}: {
  mode: 'create' | 'edit';
  programId?: string;
}) {
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [batches, setBatches] = useState<DraftBatch[]>([newDraftBatch()]);
  const [hydrated, setHydrated] = useState(mode === 'create');
  const programSchema = useMemo(
    () =>
      (mode === 'create' ? createProgramSchema : updateProgramSchema) as ZodSchema<
        Record<string, unknown>
      >,
    [mode],
  );
  const { errors, validate, clearField, fieldClassName, applyApiErrors } =
    useFormErrors(programSchema);

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: Branch[] }>('/branches', { token }),
    enabled: !!token,
  });

  // Preselect scoped branch when scope is a single branch; require explicit
  // pick when scope is All / multiple branches (no first-branch fallback).
  const pageScope = usePageBranchScopeOptional();
  const scopedSingleBranchId = pageScope?.singleBranchId ?? null;
  const effectiveBranchId = branchId || user?.branchId || scopedSingleBranchId || '';

  const { data: subjects } = useQuery({
    queryKey: queryKeys.subjects,
    queryFn: () => apiClient<{ data: SubjectOption[] }>('/subjects', { token }),
    enabled: !!token,
  });

  const { data: program, isLoading: programLoading } = useQuery({
    queryKey: queryKeys.programDetail(programId ?? ''),
    queryFn: () => apiClient<ProgramDetailResponse>(`/programs/${programId}`, { token }),
    enabled: !!token && mode === 'edit' && !!programId,
  });

  useEffect(() => {
    if (!program || hydrated) return;
    setBranchId(program.branchId);
    setName(program.name);
    setCode(program.code ?? '');
    setBatches(
      program.batches.length
        ? program.batches.map((b) => ({
            key: b.id,
            id: b.id,
            name: b.name,
            subjectIds: b.subjects.map((s) => s.id),
          }))
        : [newDraftBatch()],
    );
    setHydrated(true);
  }, [program, hydrated]);

  const branchOptions = useMemo(
    () => (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (mode === 'create') {
        return apiClient<ProgramDetailResponse>('/programs', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
      }

      return apiClient<ProgramDetailResponse>(`/programs/${programId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Program created' : 'Program updated');
      invalidateAcademic(queryClient);
      if (programId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.programDetail(programId) });
      }
      router.push('/dashboard/academic');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const buildPayload = () => {
    const payloadBatches = batches
      .filter((b) => b.name.trim().length > 0)
      .map((b) => ({
        ...(b.id ? { id: b.id } : {}),
        name: b.name.trim(),
        subjectIds: b.subjectIds,
      }));

    if (mode === 'create') {
      return {
        branchId: effectiveBranchId,
        name: name.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
        batches: payloadBatches,
      };
    }

    return {
      name: name.trim(),
      ...(code.trim() ? { code: code.trim() } : {}),
      batches: payloadBatches,
    };
  };

  const updateBatch = (key: string, patch: Partial<DraftBatch>) => {
    setBatches((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };

  const title = mode === 'create' ? 'Add program' : 'Edit program';
  const isLoading = mode === 'edit' && (programLoading || !hydrated);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="flex items-center gap-1 text-sm text-[var(--text-sub-500)]">
        <Link href="/dashboard/academic" className="hover:text-[var(--text-main-900)]">
          Academic
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--text-main-900)]">{title}</span>
      </div>

      <PageHeader
        icon={BookOpen}
        title={title}
        description="Define the program, its batches, and subjects for each batch."
      />

      {isLoading ? (
        <ContentPanel>
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--neutral-50)]" />
            ))}
          </div>
        </ContentPanel>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = buildPayload();
            if (!validate(payload)) return;
            saveMutation.mutate(payload);
          }}
        >
          <ContentPanel title="Program details">
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              {!user?.branchId ? (
                <div className="sm:col-span-2">
                  <FormFieldLabel required>Branch</FormFieldLabel>
                  {mode === 'edit' ? (
                    <p className="text-sm text-[var(--text-main-900)]">
                      {branchOptions.find((b) => b.value === effectiveBranchId)?.label ??
                        effectiveBranchId}
                    </p>
                  ) : (
                    <SelectDropdown
                      fullWidth
                      aria-label="Branch"
                      placeholder="Select branch"
                      value={effectiveBranchId}
                      onValueChange={(value) => {
                        setBranchId(value);
                        clearField('branchId');
                      }}
                      options={[{ value: '', label: 'Select branch' }, ...branchOptions]}
                      className={fieldClassName('branchId', 'w-full')}
                    />
                  )}
                  <FormFieldError message={errors.branchId} />
                </div>
              ) : null}
              <div>
                <FormFieldLabel required>Program name</FormFieldLabel>
                <input
                  className={fieldClassName('name', modalFieldClassName)}
                  placeholder="e.g. Intermediate"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearField('name');
                  }}
                />
                <FormFieldError message={errors.name} />
              </div>
              <div>
                <FormFieldLabel>Code</FormFieldLabel>
                <input
                  className={fieldClassName('code', modalFieldClassName)}
                  placeholder="Optional code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    clearField('code');
                  }}
                />
                <FormFieldError message={errors.code} />
              </div>
            </div>
          </ContentPanel>

          <ContentPanel
            title="Batches"
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBatches((prev) => [...prev, newDraftBatch()])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add batch
              </Button>
            }
          >
            <div className="space-y-4 px-5 py-4">
              {batches.map((batch, index) => (
                <div
                  key={batch.key}
                  className="space-y-3 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] p-4"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <FormFieldLabel required>Batch {index + 1} name</FormFieldLabel>
                      <input
                        className={fieldClassName(
                          `batches.${index}.name`,
                          modalFieldClassName,
                        )}
                        placeholder="e.g. Morning A"
                        value={batch.name}
                        onChange={(e) => {
                          updateBatch(batch.key, { name: e.target.value });
                          clearField(`batches.${index}.name`);
                        }}
                      />
                      <FormFieldError message={errors[`batches.${index}.name`]} />
                    </div>
                    {batches.length > 1 && !batch.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-6"
                        onClick={() =>
                          setBatches((prev) => prev.filter((b) => b.key !== batch.key))
                        }
                        aria-label={`Remove batch ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div>
                    <FormFieldLabel>Subjects</FormFieldLabel>
                    <SubjectChecklist
                      subjects={subjects?.data ?? []}
                      selectedIds={batch.subjectIds}
                      onChange={(subjectIds) => updateBatch(batch.key, { subjectIds })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ContentPanel>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/academic')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {mode === 'create' ? 'Create program' : 'Save program'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
