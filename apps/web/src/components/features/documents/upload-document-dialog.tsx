'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { createDocumentSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentDocument } from '@/lib/upload-document';
import { handleFormValidationError } from '@/lib/form-api-error';
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

const CATEGORIES = [
  { value: 'admission_form', label: 'Admission form' },
  { value: 'b_form', label: 'B-Form' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'fee_receipt', label: 'Fee receipt' },
  { value: 'academic_record', label: 'Academic record' },
  { value: 'other', label: 'Other' },
] as const;

const emptyForm = {
  studentId: '',
  category: 'other',
  title: '',
};

export function UploadDocumentDialog({
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
  const [pickedBranchId, setPickedBranchId] = useState('');
  const effectiveBranchId = branchId || pickedBranchId;
  const [file, setFile] = useState<File | null>(null);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors, setFieldError } =
    useFormErrors(createDocumentSchema);

  const { data: students } = useStudentsOptions(token, effectiveBranchId, open);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setPickedBranchId('');
      setFile(null);
      clearAll();
    }
  }, [open, clearAll]);

  useEffect(() => {
    setForm((prev) => (prev.studentId ? { ...prev, studentId: '' } : prev));
  }, [effectiveBranchId]);

  const uploadMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const uploaded = await uploadStudentDocument(file!, form.studentId, effectiveBranchId, token!);
      return apiClient('/documents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...payload,
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
    },
    onMutate: () => ({ toastId: toast.loading('Uploading document…') }),
    onSuccess: (_data, _vars, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentsStats });
      onOpenChange(false);
    },
    onError: (err: Error, _vars, ctx) => {
      toast.dismiss(ctx?.toastId);
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFieldError('file', 'File is required');
      return;
    }
    const payload = {
      branchId: effectiveBranchId,
      studentId: form.studentId,
      category: form.category,
      title: form.title.trim(),
      storagePath: 'pending',
    };
    if (!validate(payload)) return;
    uploadMutation.mutate(payload);
  };

  const canSubmit = form.studentId && form.title.trim() && file && effectiveBranchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Upload className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription className="mt-1">Attach a file to a student record</DialogDescription>
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
            {!branchId && (
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
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  clearField('title');
                }}
              />
              <FormFieldError message={errors.title} />
            </div>

            <div>
              <FormFieldLabel required>Student</FormFieldLabel>
              <SelectDropdown
                aria-label="Student"
                placeholder={effectiveBranchId ? 'Select student' : 'Select branch first'}
                disabled={!effectiveBranchId}
                value={form.studentId}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, studentId: value }));
                  clearField('studentId');
                }}
                options={[
                  { value: '', label: 'Select student' },
                  ...(students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? []),
                ]}
                className="w-full"
              />
              <FormFieldError message={errors.studentId} />
            </div>

            <div>
              <FormFieldLabel required>Category</FormFieldLabel>
              <SelectDropdown
                aria-label="Category"
                placeholder="Select category"
                value={form.category}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, category: value }));
                  clearField('category');
                }}
                options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                className="w-full"
              />
              <FormFieldError message={errors.category} />
            </div>

            <div>
              <FormFieldLabel required>File</FormFieldLabel>
              <input
                type="file"
                className={cn(fieldClassName('file', modalFieldClassName), 'py-2')}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  clearField('file');
                }}
              />
              <FormFieldError message={errors.file} />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={uploadMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={uploadMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
