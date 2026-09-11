'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ZodTypeAny } from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useUsersOptions } from '@/hooks/use-users-options';
import { useStudentsOptions } from '@/hooks/use-students-options';
import { useBatches } from '@/hooks/use-batches';
import { useSubjectsOptions } from '@/hooks/use-subjects-options';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type OpsFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'student'
  | 'user'
  | 'batch'
  | 'subject'
  | 'vendor'
  | 'fund'
  | 'budget';

export type OpsField = {
  name: string;
  label: string;
  type: OpsFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  createOnly?: boolean;
};

export type OpsColumn = {
  key: string;
  header: string;
  nested?: string;
  badge?: boolean;
};

export type OpsExtraAction = {
  label: string;
  path: (row: Record<string, unknown>) => string;
  fields: OpsField[];
  showIf?: (row: Record<string, unknown>) => boolean;
  successMessage: string;
};

function nestedValue(row: Record<string, unknown>, path: string): unknown {
  let current: unknown = row;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? '';
}

function formatCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value).replaceAll('_', ' ');
}

export function OpsRecordsPanel({
  title,
  path,
  queryKeyPrefix,
  branchId,
  managePermission,
  columns,
  fields,
  createSchema,
  updateSchema,
  createLabel = 'Add record',
  extraQuery,
  extraActions = [],
  allowEdit = true,
  hideCreate = false,
  packCreate,
}: {
  title: string;
  path: string;
  queryKeyPrefix: string;
  branchId: string;
  managePermission: string;
  columns: OpsColumn[];
  fields: OpsField[];
  createSchema: ZodTypeAny;
  updateSchema?: ZodTypeAny;
  createLabel?: string;
  extraQuery?: Record<string, string>;
  extraActions?: OpsExtraAction[];
  allowEdit?: boolean;
  hideCreate?: boolean;
  packCreate?: (form: Record<string, string>) => Record<string, unknown>;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [extraRow, setExtraRow] = useState<Record<string, unknown> | null>(null);
  const [extraAction, setExtraAction] = useState<OpsExtraAction | null>(null);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(search ? { search } : {}),
    ...(extraQuery ?? {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.opsRecords(queryKeyPrefix, branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value != null && value !== '') params.set(key, String(value));
      }
      return apiClient<PaginatedResponse<Record<string, unknown>>>(`${path}?${params}`, { token });
    },
    enabled: !!token && !!branchId,
  });

  const rows = data?.data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.opsRecords(queryKeyPrefix, branchId) });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`${path}/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Record deleted');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || 'Unable to delete record'),
  });

  return (
    <>
      <ContentPanel
        title={title}
        actions={
          hideCreate ? undefined : (
            <PermissionGate permission={managePermission}>
              <Button className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
                <PageHeaderActionIcon />
                {createLabel}
              </Button>
            </PermissionGate>
          )
        }
      >
        <div className="px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load records.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[720px]')}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className={dataTableThClass}>
                        {col.header}
                      </th>
                    ))}
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={columns.length + 1} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]"
                      >
                        No records found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={String(row.id)}>
                        {columns.map((col) => {
                          const value = col.nested
                            ? nestedValue(row, col.nested)
                            : row[col.key];
                          return (
                            <td key={col.key} className={dataTableTdClass}>
                              {col.badge ? (
                                <StatusBadge
                                  label={formatCell(value)}
                                  code={String(value ?? 'draft')}
                                />
                              ) : (
                                formatCell(value)
                              )}
                            </td>
                          );
                        })}
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={managePermission}>
                            <RowActionsMenu
                              items={[
                                ...(allowEdit
                                  ? [{ label: 'Edit', onClick: () => setEditRow(row) }]
                                  : []),
                                ...extraActions
                                  .filter((action) => !action.showIf || action.showIf(row))
                                  .map((action) => ({
                                    label: action.label,
                                    onClick: () => {
                                      setExtraRow(row);
                                      setExtraAction(action);
                                    },
                                  })),
                                {
                                  label: 'Delete',
                                  onClick: () => {
                                    if (confirm('Delete this record?')) {
                                      deleteMutation.mutate(String(row.id));
                                    }
                                  },
                                },
                              ]}
                            />
                          </PermissionGate>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={page}
              limit={limit}
              totalPages={data?.meta?.totalPages ?? 1}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </>
        )}
      </ContentPanel>

      <OpsRecordDialog
        open={createOpen || !!editRow}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditRow(null);
          }
        }}
        title={editRow ? 'Edit record' : createLabel}
        branchId={branchId}
        path={path}
        token={token}
        fields={fields}
        schema={editRow ? (updateSchema ?? createSchema) : createSchema}
        row={editRow}
        packCreate={packCreate}
        onSaved={() => {
          invalidate();
          setCreateOpen(false);
          setEditRow(null);
        }}
      />

      {extraAction && extraRow ? (
        <OpsRecordDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setExtraAction(null);
              setExtraRow(null);
            }
          }}
          title={extraAction.label}
          branchId={branchId}
          path={extraAction.path(extraRow)}
          token={token}
          fields={extraAction.fields}
          schema={createSchema}
          skipSchema
          method="POST"
          successMessage={extraAction.successMessage}
          onSaved={() => {
            invalidate();
            setExtraAction(null);
            setExtraRow(null);
          }}
        />
      ) : null}
    </>
  );
}

function OpsRecordDialog({
  open,
  onOpenChange,
  title,
  branchId,
  path,
  token,
  fields,
  schema,
  row,
  packCreate,
  method,
  skipSchema,
  successMessage,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  branchId: string;
  path: string;
  token: string | null | undefined;
  fields: OpsField[];
  schema: ZodTypeAny;
  row?: Record<string, unknown> | null;
  packCreate?: (form: Record<string, string>) => Record<string, unknown>;
  method?: 'POST' | 'PATCH';
  skipSchema?: boolean;
  successMessage?: string;
  onSaved: () => void;
}) {
  const isEdit = Boolean(row?.id) && !method;
  const fieldKey = `${isEdit ? 'edit' : 'create'}:${(fields ?? []).map((field) => field.name).join('|')}`;
  const visibleFields = useMemo(
    () => (fields ?? []).filter((field) => !(isEdit && field.createOnly)),
    // Parent pages pass a new `fields` array each render; key on names instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fieldKey captures name/create-only identity
    [fieldKey],
  );
  const [form, setForm] = useState<Record<string, string>>({});
  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } = useFormErrors(schema);

  useEffect(() => {
    if (!open) {
      clearAll();
      return;
    }
    const next: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = row?.[field.name];
      next[field.name] = value == null ? '' : String(value);
    }
    setForm(next);
  }, [open, row, visibleFields, clearAll]);

  const { data: users } = useUsersOptions(token, branchId, { enabled: open });
  const { data: students } = useStudentsOptions(token, branchId, open);
  const { data: batches } = useBatches(token, branchId, undefined, open);
  const { data: subjects } = useSubjectsOptions(token, { enabled: open });
  const { data: vendors } = useQuery({
    queryKey: queryKeys.opsRecords('vendors-options', branchId),
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; name: string }>>(
        `/finance-ops/vendors?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: open && !!token && fields.some((f) => f.type === 'vendor'),
  });
  const { data: funds } = useQuery({
    queryKey: queryKeys.opsRecords('petty-funds-options', branchId),
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; name: string }>>(
        `/finance-ops/petty-cash/funds?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: open && !!token && fields.some((f) => f.type === 'fund'),
  });
  const { data: budgets } = useQuery({
    queryKey: queryKeys.opsRecords('budget-options', branchId),
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; name: string; year: number }>>(
        `/accounting/budgets?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: open && !!token && fields.some((f) => f.type === 'budget'),
  });

  const optionsFor = (field: OpsField): { value: string; label: string }[] => {
    if (field.options) return field.options;
    if (field.type === 'user') {
      return (users?.data ?? []).map((u) => ({ value: u.id, label: u.fullName }));
    }
    if (field.type === 'student') {
      return (students?.data ?? []).map((s) => ({
        value: s.id,
        label: s.rollNumber ? `${s.fullName} (${s.rollNumber})` : s.fullName,
      }));
    }
    if (field.type === 'batch') {
      return (batches?.data ?? []).map((b) => ({ value: b.id, label: b.name }));
    }
    if (field.type === 'subject') {
      return (subjects?.data ?? []).map((s) => ({ value: s.id, label: s.name }));
    }
    if (field.type === 'vendor') {
      return (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name }));
    }
    if (field.type === 'fund') {
      return (funds?.data ?? []).map((f) => ({ value: f.id, label: f.name }));
    }
    if (field.type === 'budget') {
      return (budgets?.data ?? []).map((b) => ({
        value: b.id,
        label: `${b.name} (${b.year})`,
      }));
    }
    return [];
  };

  const buildPayload = () => {
    const packed = packCreate && !isEdit ? packCreate(form) : null;
    const payload: Record<string, unknown> = packed ? { ...packed } : {};
    if (!packed) {
      for (const field of visibleFields) {
        const raw = form[field.name] ?? '';
        if (raw === '') {
          if (isEdit && !field.required) payload[field.name] = null;
          continue;
        }
        payload[field.name] = field.type === 'number' ? Number(raw) : raw;
      }
    }
    if (!isEdit && method !== 'POST') payload.branchId = branchId;
    return payload;
  };

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (isEdit && row?.id) {
        return apiClient(`${path}/${row.id}`, { method: 'PATCH', token, body: payload });
      }
      return apiClient(path, { method: method ?? 'POST', token, body: payload });
    },
    onSuccess: () => {
      toast.success(successMessage ?? (isEdit ? 'Record updated' : 'Record created'));
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to save record');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!skipSchema && !validate(isEdit ? payload : { branchId, ...payload })) return;
    mutation.mutate(isEdit ? payload : skipSchema ? payload : { branchId, ...payload });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">Enter the details and save</DialogDescription>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="grid gap-4">
            {visibleFields.map((field) => {
              const selectTypes: OpsFieldType[] = [
                'select',
                'student',
                'user',
                'batch',
                'subject',
                'vendor',
                'fund',
                'budget',
              ];
              return (
                <div key={field.name}>
                  <FormFieldLabel label={field.label} required={field.required} />
                  {selectTypes.includes(field.type) ? (
                    <SelectDropdown
                      value={form[field.name] ?? ''}
                      onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, [field.name]: value }));
                        clearField(field.name);
                      }}
                      options={optionsFor(field)}
                      placeholder={`Select ${field.label.toLowerCase()}`}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      className={fieldClassName(field.name, modalFieldClassName)}
                      value={form[field.name] ?? ''}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [field.name]: e.target.value }));
                        clearField(field.name);
                      }}
                    />
                  ) : (
                    <Input
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'datetime'
                            ? 'datetime-local'
                            : field.type === 'date'
                              ? 'date'
                              : 'text'
                      }
                      className={fieldClassName(field.name, modalFieldClassName)}
                      value={form[field.name] ?? ''}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [field.name]: e.target.value }));
                        clearField(field.name);
                      }}
                    />
                  )}
                  <FormFieldError message={errors[field.name]} />
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OpsStatusSummary({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return <ContentPanel title={title}>{<div className="px-5 py-4 text-sm">{children}</div>}</ContentPanel>;
}
