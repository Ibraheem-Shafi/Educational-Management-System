'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentDocument } from '@/lib/upload-document';
import type { PaginatedResponse } from '@eims/types';
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

const CATEGORIES = [
  { value: 'admission_form', label: 'Admission form' },
  { value: 'b_form', label: 'B-Form' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'fee_receipt', label: 'Fee receipt' },
  { value: 'academic_record', label: 'Academic record' },
  { value: 'other', label: 'Other' },
] as const;

interface Student {
  id: string;
  fullName: string;
}

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
  const [file, setFile] = useState<File | null>(null);

  const { data: students } = useQuery({
    queryKey: ['students-docs'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setFile(null);
    }
  }, [open]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !form.studentId || !form.title.trim()) throw new Error('Missing fields');
      const uploaded = await uploadStudentDocument(file, form.studentId);
      return apiClient('/documents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId,
          studentId: form.studentId,
          category: form.category,
          title: form.title.trim(),
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = form.studentId && form.title.trim() && file;

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

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Student</FormFieldLabel>
              <SelectDropdown
                aria-label="Student"
                placeholder="Select student"
                value={form.studentId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, studentId: value }))}
                options={[
                  { value: '', label: 'Select student' },
                  ...(students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Category</FormFieldLabel>
              <SelectDropdown
                aria-label="Category"
                placeholder="Select category"
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Title</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <FormFieldLabel required>File</FormFieldLabel>
              <input
                type="file"
                className={cn(modalFieldClassName, 'py-2')}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
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
