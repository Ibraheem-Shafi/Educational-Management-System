'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormInput, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, createFormFieldSchema, updateFormFieldSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { FormFieldError } from '@/components/forms/form-field-error';
import { useFormErrors } from '@/hooks/use-form-errors';

const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox', 'file'] as const;

interface FormField {
  id: string;
  code: string;
  label: string;
  fieldType: string;
  options?: string[] | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

const fieldTypeOptions = FIELD_TYPES.map((t) => ({ value: t, label: t }));

interface FieldFormState {
  code: string;
  label: string;
  fieldType: string;
  options: string;
  isRequired: boolean;
  sortOrder: string;
}

const emptyForm: FieldFormState = {
  code: '',
  label: '',
  fieldType: 'text',
  options: '',
  isRequired: false,
  sortOrder: '0',
};

export default function FormFieldsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.FORM_FIELDS_MANAGE);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FieldFormState>(emptyForm);
  const [removeTarget, setRemoveTarget] = useState<FormField | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const createFormErrors = useFormErrors(createFormFieldSchema);
  const updateFormErrors = useFormErrors(updateFormFieldSchema);
  const { errors, clearField, validate, fieldClassName } = editId
    ? updateFormErrors
    : createFormErrors;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.formFields({ page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<FormField>>(`/form-fields?${queryParams.toString()}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const pageFields = data?.data ?? [];

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    createFormErrors.clearAll();
    setDialogOpen(true);
  };

  const openEdit = (f: FormField) => {
    setEditId(f.id);
    setForm({
      code: f.code,
      label: f.label,
      fieldType: f.fieldType,
      options: f.options?.join(', ') ?? '',
      isRequired: f.isRequired,
      sortOrder: String(f.sortOrder),
    });
    updateFormErrors.clearAll();
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/form-fields', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field created');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields() });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, createFormErrors.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/form-fields/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields() });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, updateFormErrors.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/form-fields/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Field removed');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields() });
      setRemoveTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const optionsArray = form.options
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      const body = {
        label: form.label.trim(),
        fieldType: form.fieldType,
        isRequired: form.isRequired,
        sortOrder: Number(form.sortOrder) || 0,
        ...(form.fieldType === 'dropdown' ? { options: optionsArray } : {}),
      };
      if (!validate(body)) return;
      updateMutation.mutate({ id: editId, body });
      return;
    }

    const body = {
      code: form.code.trim().toLowerCase().replace(/\s+/g, '_'),
      label: form.label.trim(),
      fieldType: form.fieldType,
      isRequired: form.isRequired,
      ...(form.fieldType === 'dropdown' && optionsArray.length ? { options: optionsArray } : {}),
    };
    if (!validate(body)) return;
    createMutation.mutate(body);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={FormInput}
        title="Admission form fields"
        description="Custom fields shown on student admission"
        actions={
          canManage ? (
            <button type="button" onClick={openCreate} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Add field
            </button>
          ) : undefined
        }
      />

      <MainStatsSection
        isLoading={isLoading}
        stats={[
          { label: 'Total fields', value: data?.meta.total ?? 0 },
          { label: 'Active fields', value: data?.meta.total ?? 0 },
          {
            label: 'Required fields',
            value: pageFields.filter((f) => f.isRequired).length,
          },
          {
            label: 'Dropdown fields',
            value: pageFields.filter((f) => f.fieldType === 'dropdown').length,
          },
        ]}
      />

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Label</th>
                <th className={dataTableThClass}>Code</th>
                <th className={dataTableThClass}>Type</th>
                <th className={dataTableThClass}>Required</th>
                <th className={dataTableThClass}>Order</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading ? (
                <DataTableSkeletonRows columns={6} rows={limit} />
              ) : pageFields.length === 0 ? (
                <EmptyStateCell colSpan={6} title="No active fields" />
              ) : (
                pageFields.map((f) => (
                  <tr
                    key={f.id}
                    className={statusRowClass(
                      f.isRequired ? 'active' : 'pending',
                      f.isRequired ? 'Required' : 'Optional',
                    )}
                  >
                    <td className={dataTableTdClass}>{f.label}</td>
                    <td className={dataTableTdClass}>{f.code}</td>
                    <td className={dataTableTdClass}>{f.fieldType}</td>
                    <td className={dataTableTdClass}>
                      {f.isRequired ? <StatusBadge label="Required" code="active" /> : '—'}
                    </td>
                    <td className={dataTableTdClass}>{f.sortOrder > 0 ? f.sortOrder : '—'}</td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      {canManage ? (
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Edit',
                              onClick: () => openEdit(f),
                              icon: <Pencil className="h-4 w-4 shrink-0 text-[var(--text-soft-400,#868C98)]" strokeWidth={1.5} />,
                            },
                            {
                              label: 'Remove',
                              onClick: () => setRemoveTarget(f),
                              icon: <Trash2 className="h-4 w-4 shrink-0 text-red-500" strokeWidth={1.5} />,
                            },
                          ]}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.meta && (
          <PaginationBar
            page={page}
            totalPages={data.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>{editId ? 'Edit field' : 'Add field'}</DialogTitle>
              <DialogDescription>
                {editId ? 'Update this admission form field.' : 'Create a custom admission form field.'}
              </DialogDescription>
            </div>
            <button type="button" onClick={() => setDialogOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="grid gap-4 px-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div>
              <Input
                placeholder="Code (e.g. previous_school)"
                value={form.code}
                onChange={(e) => {
                  setForm((s) => ({ ...s, code: e.target.value }));
                  clearField('code');
                }}
                disabled={!!editId}
                className={fieldClassName('code', '')}
              />
              <FormFieldError message={errors.code} />
            </div>
            <div>
              <Input
                placeholder="Label"
                value={form.label}
                onChange={(e) => {
                  setForm((s) => ({ ...s, label: e.target.value }));
                  clearField('label');
                }}
                className={fieldClassName('label', '')}
              />
              <FormFieldError message={errors.label} />
            </div>
            <div>
              <SelectDropdown
                aria-label="Field type"
                value={form.fieldType}
                onValueChange={(v) => {
                  setForm((s) => ({ ...s, fieldType: v }));
                  clearField('fieldType');
                }}
                options={fieldTypeOptions}
                fullWidth
              />
              <FormFieldError message={errors.fieldType} />
            </div>
            {editId && (
              <div>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sort order"
                  value={form.sortOrder}
                  onChange={(e) => {
                    setForm((s) => ({ ...s, sortOrder: e.target.value }));
                    clearField('sortOrder');
                  }}
                  className={fieldClassName('sortOrder', '')}
                />
                <FormFieldError message={errors.sortOrder} />
              </div>
            )}
            {form.fieldType === 'dropdown' && (
              <div className="sm:col-span-2">
                <Input
                  placeholder="Options (comma-separated)"
                  value={form.options}
                  onChange={(e) => {
                    setForm((s) => ({ ...s, options: e.target.value }));
                    clearField('options');
                  }}
                  className={fieldClassName('options', '')}
                />
                <FormFieldError message={errors.options} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm((s) => ({ ...s, isRequired: e.target.checked }))}
              />
              Required field
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editId ? 'Save changes' : 'Add field'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove field"
        description={removeTarget ? `Remove field "${removeTarget.label}"? This hides it from the admission form.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => removeTarget && deactivateMutation.mutate(removeTarget.id)}
      />
    </div>
  );
}
