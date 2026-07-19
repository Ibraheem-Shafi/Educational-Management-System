'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { createSubjectSchema, updateSubjectSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

export interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
}

function invalidateSubjects(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
  queryClient.invalidateQueries({ queryKey: ['subjects'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
}

export function SubjectChecklist({
  subjects,
  selectedIds,
  onChange,
  allowCreate = true,
  allowRename = true,
  className,
}: {
  subjects: SubjectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  allowCreate?: boolean;
  allowRename?: boolean;
  className?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const {
    errors: createErrors,
    validate: validateCreate,
    clearField: clearCreateField,
    fieldClassName: createFieldClassName,
    applyApiErrors: applyCreateApiErrors,
  } = useFormErrors(createSubjectSchema);
  const {
    errors: renameErrors,
    validate: validateRename,
    clearField: clearRenameField,
    applyApiErrors: applyRenameApiErrors,
  } = useFormErrors(updateSubjectSchema);

  const createSubject = useMutation({
    mutationFn: (body: { name: string; code?: string }) =>
      apiClient<SubjectOption>('/subjects', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: (created) => {
      toast.success('Subject created');
      invalidateSubjects(queryClient);
      if (!selectedIds.includes(created.id)) {
        onChange([...selectedIds, created.id]);
      }
      setNewName('');
      setNewCode('');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyCreateApiErrors)) return;
      toast.error(err.message);
    },
  });

  const renameSubject = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient(`/subjects/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      toast.success('Subject renamed');
      invalidateSubjects(queryClient);
      setRenamingId(null);
      setRenameValue('');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyRenameApiErrors)) return;
      toast.error(err.message);
    },
  });

  const toggleSubject = (subjectId: string) => {
    onChange(
      selectedIds.includes(subjectId)
        ? selectedIds.filter((id) => id !== subjectId)
        : [...selectedIds, subjectId],
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="max-h-48 overflow-y-auto rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)]">
        {subjects.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[var(--text-sub-500)]">No subjects yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--stroke-soft-200,#E2E4E9)]">
            {subjects.map((subject) => {
              const checked = selectedIds.includes(subject.id);
              const isRenaming = renamingId === subject.id;
              return (
                <li
                  key={subject.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 transition-colors',
                    checked && 'bg-[color-mix(in_srgb,var(--institution-primary)_8%,white)]',
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Select ${subject.name}`}
                    onClick={() => toggleSubject(subject.id)}
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      checked
                        ? 'border-[var(--institution-primary)] bg-[var(--institution-primary)] text-white'
                        : 'border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
                    )}
                  >
                    {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </button>
                  {isRenaming ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => {
                          setRenameValue(e.target.value);
                          clearRenameField('name');
                        }}
                        className={cn('h-8', renameErrors.name && 'border-red-500')}
                        autoFocus
                      />
                      <FormFieldError message={renameErrors.name} />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={renameSubject.isPending}
                        onClick={() => {
                          const payload = { name: renameValue.trim() };
                          if (!validateRename(payload)) return;
                          renameSubject.mutate({ id: subject.id, name: payload.name });
                        }}
                        aria-label="Save subject name"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenamingId(null);
                          setRenameValue('');
                        }}
                        aria-label="Cancel rename"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm text-[var(--text-main-900)]"
                        onClick={() => toggleSubject(subject.id)}
                      >
                        {subject.name}
                        {subject.code ? (
                          <span className="ml-1 text-[var(--text-sub-500)]">({subject.code})</span>
                        ) : null}
                      </button>
                      {allowRename ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRenamingId(subject.id);
                            setRenameValue(subject.name);
                          }}
                          aria-label={`Rename ${subject.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {allowCreate ? (
        <div>
          <FormFieldLabel>New subject</FormFieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={createFieldClassName('name', modalFieldClassName)}
              placeholder="Subject name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                clearCreateField('name');
              }}
            />
            <input
              className={createFieldClassName('code', cn(modalFieldClassName, 'sm:max-w-[140px]'))}
              placeholder="Code (optional)"
              value={newCode}
              onChange={(e) => {
                setNewCode(e.target.value);
                clearCreateField('code');
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={createSubject.isPending}
              onClick={() => {
                const payload = {
                  name: newName.trim(),
                  ...(newCode.trim() ? { code: newCode.trim() } : {}),
                };
                if (!validateCreate(payload)) return;
                createSubject.mutate(payload);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          <FormFieldError message={createErrors.name ?? createErrors.code} />
        </div>
      ) : null}
    </div>
  );
}
