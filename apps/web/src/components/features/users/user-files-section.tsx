'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS, createDocumentSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { uploadEmployeeDocument } from '@/lib/upload-employee-document';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

const EMPLOYEE_CATEGORIES = [
  { value: 'employee_contract', label: 'Employment contract' },
  { value: 'employee_id', label: 'Employee ID' },
  { value: 'employee_other', label: 'Other' },
] as const;

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  createdAt: string;
}

function categoryLabel(value: string): string {
  return EMPLOYEE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function UserFilesSection({
  userId,
  branchId,
}: {
  userId: string;
  branchId: string | null;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canUpload = can(PERMISSIONS.DOCUMENTS_UPLOAD);
  const [category, setCategory] = useState('employee_other');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { errors, validate, clearField, applyApiErrors, setFieldError } =
    useFormErrors(createDocumentSchema);

  const { data, isLoading } = useQuery({
    queryKey: ['user-documents', userId, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<DocumentRow>>(
        `/documents?userId=${userId}&page=${page}&limit=${limit}`,
        { token },
      ),
    enabled: !!token && !!userId,
    placeholderData: (previous) => previous,
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const file = payload._file as File;
      const uploaded = await uploadEmployeeDocument(file, userId, branchId!, token!);
      return apiClient('/documents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: payload.branchId,
          userId: payload.userId,
          category: payload.category,
          title: payload.title,
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('File uploaded');
      queryClient.invalidateQueries({ queryKey: ['user-documents', userId] });
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleFileChange = async (file: File) => {
    if (!branchId) return;
    const payload = {
      branchId,
      userId,
      category,
      title: file.name,
      storagePath: 'pending',
      _file: file,
    };
    if (!validate(payload)) return;
    uploadMutation.mutate(payload);
  };

  const openDocument = async (docId: string) => {
    try {
      const res = await apiClient<{ url: string }>(`/documents/${docId}/signed-url`, { token });
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open file');
    }
  };

  const docs = data?.data ?? [];

  if (!branchId) {
    return <p className="text-sm text-[var(--text-sub-500)]">Assign a branch to manage employee files.</p>;
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-sm text-[var(--text-sub-500)]">Category</label>
            <SelectDropdown
              aria-label="Document category"
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                clearField('category');
              }}
              options={[...EMPLOYEE_CATEGORIES]}
              fullWidth
            />
            <FormFieldError message={errors.category} />
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm font-medium hover:bg-[var(--neutral-50)]">
            Upload file
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!category) {
                  setFieldError('category', 'Category is required');
                  e.target.value = '';
                  return;
                }
                void handleFileChange(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Title</th>
              <th className={dataTableThClass}>Category</th>
              <th className={dataTableThClass}>Uploaded</th>
              <th className={dataTableThClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                  Loading…
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                  No files uploaded
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.id}>
                  <td className={dataTableTdClass}>{doc.title}</td>
                  <td className={dataTableTdClass}>{categoryLabel(doc.category)}</td>
                  <td className={dataTableTdClass}>
                    {new Date(doc.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className={dataTableTdClass}>
                    <button type="button" onClick={() => openDocument(doc.id)} className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline">
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data?.meta && data.meta.totalPages > 0 && (
        <PaginationBar
          page={page}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
