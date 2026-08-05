'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createParentSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { normalizePakistanPhone } from '@/lib/form-validation';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useStudentsOptions } from '@/hooks/use-students-options';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { BranchSelectField } from '@/components/forms/branch-select-field';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  studentId: '',
  relationship: 'father',
};

export function AddParentDialog({
  open,
  onOpenChange,
  branchId = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [pickedBranchId, setPickedBranchId] = useState('');
  const effectiveBranchId = branchId || pickedBranchId;
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createParentSchema);

  const { data: students } = useStudentsOptions(token, effectiveBranchId, open);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setPickedBranchId('');
      clearAll();
    }
  }, [open, clearAll]);

  useEffect(() => {
    setForm((prev) => (prev.studentId ? { ...prev, studentId: '' } : prev));
  }, [effectiveBranchId]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/parents', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Parent created');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parentsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName: form.fullName.trim(),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.phone.trim() ? { phone: normalizePakistanPhone(form.phone.trim()) } : {}),
      ...(form.studentId ? { studentId: form.studentId, relationshipCode: form.relationship } : {}),
    };
    if (!validate(payload)) return;
    createMutation.mutate(payload);
  };

  const canSubmit = form.fullName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <UserPlus className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Add parent / guardian</DialogTitle>
            <DialogDescription className="mt-1">Register a guardian and optionally link a student</DialogDescription>
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
            <div>
              <FormFieldLabel required>Full name</FormFieldLabel>
              <input
                className={fieldClassName('fullName', modalFieldClassName)}
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, fullName: e.target.value }));
                  clearField('fullName');
                }}
              />
              <FormFieldError message={errors.fullName} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Email</FormFieldLabel>
                <input
                  type="email"
                  className={fieldClassName('email', modalFieldClassName)}
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, email: e.target.value }));
                    clearField('email');
                  }}
                />
                <FormFieldError message={errors.email} />
              </div>
              <div>
                <FormFieldLabel>Phone</FormFieldLabel>
                <input
                  className={fieldClassName('phone', modalFieldClassName)}
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, phone: e.target.value }));
                    clearField('phone');
                  }}
                />
                <FormFieldError message={errors.phone} />
              </div>
            </div>

            {!branchId && (
              <BranchSelectField
                value={pickedBranchId}
                onValueChange={setPickedBranchId}
                label="Branch (for student link)"
                required={false}
              />
            )}

            <div>
              <FormFieldLabel>Link to student (optional)</FormFieldLabel>
              <SelectDropdown
                aria-label="Link to student"
                placeholder={
                  effectiveBranchId ? 'No student' : 'Select branch to link a student'
                }
                disabled={!effectiveBranchId}
                value={form.studentId}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, studentId: value }));
                  clearField('studentId');
                }}
                options={[
                  { value: '', label: 'No student' },
                  ...(students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? []),
                ]}
                className="w-full"
              />
              <FormFieldError message={errors.studentId} />
            </div>

            {form.studentId && (
              <div>
                <FormFieldLabel>Relationship</FormFieldLabel>
                <SelectDropdown
                  aria-label="Relationship"
                  placeholder="Select relationship"
                  value={form.relationship}
                  onValueChange={(value) => {
                    setForm((prev) => ({ ...prev, relationship: value }));
                    clearField('relationshipCode');
                  }}
                  options={[
                    { value: 'father', label: 'Father' },
                    { value: 'mother', label: 'Mother' },
                    { value: 'guardian', label: 'Guardian' },
                  ]}
                  className="w-full"
                />
                <FormFieldError message={errors.relationshipCode} />
              </div>
            )}
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
              {createMutation.isPending ? 'Saving…' : 'Save parent'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
