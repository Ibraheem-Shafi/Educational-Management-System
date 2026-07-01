'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { useInstitution } from '@/providers/institution-provider';
import { apiClient } from '@/lib/api-client';
import { uploadInstitutionAsset } from '@/lib/upload-institution-asset';
import type { InstitutionSettingsResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

interface LookupStatus {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
}

export default function SettingsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { settings, terminology: currentTerminology } = useInstitution();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.institutionSettings,
    queryFn: () => apiClient<InstitutionSettingsResponse>('/settings/institution'),
    initialData: settings ?? undefined,
  });

  const { data: studentStatuses } = useQuery({
    queryKey: ['lookups', 'student_status'],
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/student_status', { token }),
    enabled: !!token,
  });

  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [parentPortal, setParentPortal] = useState(true);
  const [studentPortal, setStudentPortal] = useState(true);
  const [termBatch, setTermBatch] = useState('Batch');
  const [termProgram, setTermProgram] = useState('Program');
  const [termAssessment, setTermAssessment] = useState('Test');
  const [termSession, setTermSession] = useState('Session');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [currency, setCurrency] = useState('PKR');
  const [newStatusCode, setNewStatusCode] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setPrimaryColor(data.primaryColor);
    setPhone(data.phone ?? '');
    setEmail(data.email ?? '');
    setParentPortal(data.featureFlags?.parentPortal ?? true);
    setStudentPortal(data.featureFlags?.studentPortal ?? true);
    setTermBatch(data.terminology?.batch ?? 'Batch');
    setTermProgram(data.terminology?.program ?? 'Program');
    setTermAssessment(data.terminology?.assessment ?? 'Test');
    setTermSession(data.terminology?.session ?? 'Session');
    setTimezone(data.timezone ?? 'Asia/Karachi');
    setCurrency(data.currency ?? 'PKR');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/settings/institution', {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['institution-settings'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.institutionSettings });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createStatusMutation = useMutation({
    mutationFn: (body: { code: string; label: string }) =>
      apiClient('/settings/lookups/student_status/statuses', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Status added');
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      setNewStatusCode('');
      setNewStatusLabel('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiClient(`/settings/lookups/student_status/statuses/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading && !data) return <PageContentSkeleton />;

  const handleSave = () => {
    saveMutation.mutate({
      name,
      primaryColor,
      phone: phone || null,
      email: email || null,
      timezone,
      currency,
      terminology: {
        ...currentTerminology,
        batch: termBatch,
        program: termProgram,
        assessment: termAssessment,
        session: termSession,
      },
      featureFlags: {
        ...(settings?.featureFlags ?? {}),
        parentPortal,
        studentPortal,
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Institution profile, terminology, and lookups" />

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Institution name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Primary color (#hex)"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <Input placeholder="Currency (PKR)" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo</label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const url = await uploadInstitutionAsset(file, 'logo');
                  await saveMutation.mutateAsync({ logoUrl: url });
                  toast.success('Logo uploaded');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Upload failed');
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terminology</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Batch label" value={termBatch} onChange={(e) => setTermBatch(e.target.value)} />
          <Input placeholder="Program label" value={termProgram} onChange={(e) => setTermProgram(e.target.value)} />
          <Input
            placeholder="Assessment label"
            value={termAssessment}
            onChange={(e) => setTermAssessment(e.target.value)}
          />
          <Input placeholder="Session label" value={termSession} onChange={(e) => setTermSession(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={parentPortal} onChange={(e) => setParentPortal(e.target.checked)} />
            Parent portal enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={studentPortal} onChange={(e) => setStudentPortal(e.target.checked)} />
            Student portal enabled
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student statuses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y divide-border">
            {studentStatuses?.statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-2">
                <span className="w-24 text-xs text-muted-foreground">{s.code}</span>
                <Input
                  defaultValue={s.label}
                  onBlur={(e) => {
                    if (e.target.value !== s.label) {
                      updateStatusMutation.mutate({ id: s.id, label: e.target.value });
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Code"
              value={newStatusCode}
              onChange={(e) => setNewStatusCode(e.target.value)}
              className="max-w-[140px]"
            />
            <Input
              placeholder="Label"
              value={newStatusLabel}
              onChange={(e) => setNewStatusLabel(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!newStatusCode || !newStatusLabel || createStatusMutation.isPending}
              onClick={() => createStatusMutation.mutate({ code: newStatusCode, label: newStatusLabel })}
            >
              Add status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending}>
        Save settings
      </Button>
    </div>
  );
}
