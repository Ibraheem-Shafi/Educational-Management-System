'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormInput, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
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
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import { cn } from '@/lib/utils';

const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox', 'file'] as const;

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

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

export default function FormFieldsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<string>('text');
  const [options, setOptions] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editFieldType, setEditFieldType] = useState<string>('text');
  const [editOptions, setEditOptions] = useState('');
  const [editIsRequired, setEditIsRequired] = useState(false);
  const [editSortOrder, setEditSortOrder] = useState('0');

  const { data: fields, isLoading } = useQuery({
    queryKey: queryKeys.formFields,
    queryFn: () => apiClient<{ data: FormField[] }>('/form-fields?all=true', { token }),
    enabled: !!token,
  });

  const activeFields = useMemo(
    () => (fields?.data ?? []).filter((f) => f.isActive),
    [fields?.data],
  );

  const stats = useMemo(
    () => ({
      total: fields?.data.length ?? 0,
      active: activeFields.length,
      required: activeFields.filter((f) => f.isRequired).length,
      dropdown: activeFields.filter((f) => f.fieldType === 'dropdown').length,
    }),
    [fields?.data, activeFields],
  );

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/form-fields', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field created');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields });
      setCode('');
      setLabel('');
      setOptions('');
      setCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/form-fields/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields });
      setEditId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/form-fields/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Field removed');
      queryClient.invalidateQueries({ queryKey: queryKeys.formFields });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={FormInput}
        title="Admission form fields"
        description="Custom fields shown on student admission"
        actions={
          <button type="button" onClick={() => setCreateOpen(true)} className={pageHeaderActionClassName}>
            <PageHeaderActionIcon />
            Add field
          </button>
        }
      />

      <MainStatsSection
        isLoading={isLoading}
        stats={[
          { label: 'Total fields', value: stats.total },
          { label: 'Active fields', value: stats.active },
          { label: 'Required fields', value: stats.required },
          { label: 'Dropdown fields', value: stats.dropdown },
        ]}
      />

      <ContentPanel title={`Active fields (${stats.active})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Label</th>
                <th className={thClass}>Code</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Required</th>
                <th className={thClass}>Order</th>
                <th className={cn(thClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className={tdClass}>
                        <div className="h-4 w-16 animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && activeFields.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                    No active fields
                  </td>
                </tr>
              )}

              {!isLoading &&
                activeFields.map((f) => (
                  <tr key={f.id} className="hover:bg-[var(--neutral-50)]/50">
                    {editId === f.id ? (
                      <>
                        <td className={tdClass}>
                          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                        </td>
                        <td className={tdClass}>{f.code}</td>
                        <td className={tdClass}>
                          <SelectDropdown
                            aria-label="Field type"
                            value={editFieldType}
                            onValueChange={setEditFieldType}
                            options={fieldTypeOptions}
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="checkbox"
                            checked={editIsRequired}
                            onChange={(e) => setEditIsRequired(e.target.checked)}
                          />
                        </td>
                        <td className={tdClass}>
                          <Input
                            type="number"
                            min={0}
                            value={editSortOrder}
                            onChange={(e) => setEditSortOrder(e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateMutation.mutate({
                                  id: f.id,
                                  body: {
                                    label: editLabel.trim(),
                                    fieldType: editFieldType,
                                    isRequired: editIsRequired,
                                    sortOrder: Number(editSortOrder) || 0,
                                    ...(editFieldType === 'dropdown'
                                      ? {
                                          options: editOptions
                                            .split(',')
                                            .map((o) => o.trim())
                                            .filter(Boolean),
                                        }
                                      : {}),
                                  },
                                })
                              }
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={tdClass}>{f.label}</td>
                        <td className={tdClass}>{f.code}</td>
                        <td className={tdClass}>{f.fieldType}</td>
                        <td className={tdClass}>
                          {f.isRequired ? (
                            <StatusBadge label="Required" code="active" />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={tdClass}>{f.sortOrder > 0 ? f.sortOrder : '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => {
                                  setEditId(f.id);
                                  setEditLabel(f.label);
                                  setEditFieldType(f.fieldType);
                                  setEditOptions(f.options?.join(', ') ?? '');
                                  setEditIsRequired(f.isRequired);
                                  setEditSortOrder(String(f.sortOrder));
                                },
                              },
                              {
                                label: 'Remove',
                                onClick: () => {
                                  if (confirm(`Remove field "${f.label}"?`)) deactivateMutation.mutate(f.id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ContentPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>Add field</DialogTitle>
              <DialogDescription>Create a custom admission form field.</DialogDescription>
            </div>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="grid gap-4 px-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                code: code.trim().toLowerCase().replace(/\s+/g, '_'),
                label: label.trim(),
                fieldType,
                isRequired,
                ...(fieldType === 'dropdown' && options
                  ? { options: options.split(',').map((o) => o.trim()).filter(Boolean) }
                  : {}),
              });
            }}
          >
            <Input placeholder="Code (e.g. previous_school)" value={code} onChange={(e) => setCode(e.target.value)} required />
            <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            <SelectDropdown
              aria-label="Field type"
              value={fieldType}
              onValueChange={setFieldType}
              options={fieldTypeOptions}
              fullWidth
            />
            {fieldType === 'dropdown' && (
              <Input
                placeholder="Options (comma-separated)"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                className="sm:col-span-2"
              />
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
              Required field
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Add field
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
