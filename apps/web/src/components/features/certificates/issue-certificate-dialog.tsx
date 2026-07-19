'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, X } from 'lucide-react';
import { toast } from 'sonner';
import { issueCertificateSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  fullName: string;
}

interface Template {
  id: string;
  type: string;
  name: string;
}

const emptyForm = {
  studentId: '',
  templateId: '',
  title: '',
  serialNo: '',
};

export function IssueCertificateDialog({
  open,
  onOpenChange,
  branchId,
  defaultStudentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  defaultStudentId?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm, studentId: defaultStudentId ?? '' });
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(issueCertificateSchema);

  const { data: students } = useQuery({
    queryKey: ['students-certificates'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && open,
  });

  const { data: templates } = useQuery({
    queryKey: ['certificate-templates', branchId],
    queryFn: () =>
      apiClient<{ data: Template[] }>(`/certificates/templates?branchId=${branchId}`, { token }),
    enabled: !!token && open && !!branchId,
  });

  useEffect(() => {
    if (!open) {
      setForm({ ...emptyForm, studentId: defaultStudentId ?? '' });
      clearAll();
      return;
    }
    if (defaultStudentId) {
      setForm((prev) => ({ ...prev, studentId: defaultStudentId }));
    }
  }, [open, defaultStudentId, clearAll]);

  const issueMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/certificates/issue', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      toast.success('Certificate issued');
      queryClient.invalidateQueries({ queryKey: ['certificate-issues'] });
      onOpenChange(false);
      const issueId = (result as { id: string }).id;
      window.open(`/print/certificates/${issueId}`, '_blank');
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      branchId,
      studentId: form.studentId,
      templateId: form.templateId,
      ...(form.title.trim() ? { title: form.title.trim() } : {}),
      serialNo: form.serialNo.trim() || null,
    };
    if (!validate(payload)) return;
    issueMutation.mutate(payload);
  };

  const studentOptions =
    students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? [];
  const templateOptions =
    templates?.data
      .filter((t) =>
        ['completion_certificate', 'transfer_certificate', 'character_certificate'].includes(t.type),
      )
      .map((t) => ({ value: t.id, label: t.name })) ?? [];

  const canSubmit = form.studentId && form.templateId && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Award className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Issue certificate</DialogTitle>
            <DialogDescription className="mt-1">
              Generate a completion, transfer, or character certificate for a student
            </DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div>
            <FormFieldLabel required>Student</FormFieldLabel>
            <SelectDropdown
              aria-label="Student"
              placeholder="Select student"
              value={form.studentId}
              onValueChange={(value) => {
                setForm((f) => ({ ...f, studentId: value }));
                clearField('studentId');
              }}
              options={studentOptions}
              fullWidth
            />
            <FormFieldError message={errors.studentId} />
          </div>
          <div>
            <FormFieldLabel required>Template</FormFieldLabel>
            <SelectDropdown
              aria-label="Template"
              placeholder="Select template"
              value={form.templateId}
              onValueChange={(value) => {
                setForm((f) => ({ ...f, templateId: value }));
                clearField('templateId');
              }}
              options={templateOptions}
              fullWidth
            />
            <FormFieldError message={errors.templateId} />
          </div>
          <div>
            <FormFieldLabel>Title</FormFieldLabel>
            <input
              type="text"
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                clearField('title');
              }}
              placeholder="Optional custom title"
              className={fieldClassName('title', modalFieldClassName)}
            />
            <FormFieldError message={errors.title} />
          </div>
          <div>
            <FormFieldLabel>Serial number</FormFieldLabel>
            <input
              type="text"
              value={form.serialNo}
              onChange={(e) => {
                setForm((f) => ({ ...f, serialNo: e.target.value }));
                clearField('serialNo');
              }}
              className={fieldClassName('serialNo', modalFieldClassName)}
            />
            <FormFieldError message={errors.serialNo} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="flex-1 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] py-2 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={issueMutation.isPending || !canSubmit} className={cn('flex-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] py-2 text-sm font-medium text-white disabled:opacity-50')}>
              {issueMutation.isPending ? 'Issuing…' : 'Issue & print'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
