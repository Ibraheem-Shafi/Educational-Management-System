'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

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

export default function FormFieldsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

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
    queryKey: ['form-fields'],
    queryFn: () => apiClient<{ data: FormField[] }>('/form-fields?all=true', { token }),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/form-fields', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field created');
      queryClient.invalidateQueries({ queryKey: ['form-fields'] });
      setCode('');
      setLabel('');
      setOptions('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/form-fields/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Field updated');
      queryClient.invalidateQueries({ queryKey: ['form-fields'] });
      setEditId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/form-fields/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Field removed');
      queryClient.invalidateQueries({ queryKey: ['form-fields'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Admission form fields"
        description="Custom fields shown on student admission"
      />

      <Card>
        <CardHeader>
          <CardTitle>Add field</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
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
            <select
              className={filterSelectClass}
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {fieldType === 'dropdown' && (
              <Input
                placeholder="Options (comma-separated)"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
              Required field
            </label>
            <Button type="submit" disabled={createMutation.isPending} className="w-fit">
              Add field
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active fields ({fields?.data.filter((f) => f.isActive).length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {fields?.data
              .filter((f) => f.isActive)
              .map((f) => (
                <div key={f.id} className="py-3">
                  {editId === f.id ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Label" />
                      <select
                        className={filterSelectClass}
                        value={editFieldType}
                        onChange={(e) => setEditFieldType(e.target.value)}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      {editFieldType === 'dropdown' && (
                        <Input
                          placeholder="Options (comma-separated)"
                          value={editOptions}
                          onChange={(e) => setEditOptions(e.target.value)}
                          className="sm:col-span-2"
                        />
                      )}
                      <Input
                        type="number"
                        min={0}
                        placeholder="Sort order"
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editIsRequired}
                          onChange={(e) => setEditIsRequired(e.target.checked)}
                        />
                        Required
                      </label>
                      <div className="flex gap-2 sm:col-span-2">
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
                    </div>
                  ) : (
                    <ListRow
                      actions={
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditId(f.id);
                              setEditLabel(f.label);
                              setEditFieldType(f.fieldType);
                              setEditOptions(f.options?.join(', ') ?? '');
                              setEditIsRequired(f.isRequired);
                              setEditSortOrder(String(f.sortOrder));
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove field "${f.label}"?`)) deactivateMutation.mutate(f.id);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      }
                    >
                      <p className="font-medium">{f.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {f.code} · {f.fieldType}
                        {f.isRequired ? ' · required' : ''}
                        {f.sortOrder > 0 ? ` · order ${f.sortOrder}` : ''}
                      </p>
                    </ListRow>
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
