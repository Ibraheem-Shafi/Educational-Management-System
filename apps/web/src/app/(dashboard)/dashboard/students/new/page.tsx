'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentPhoto } from '@/lib/upload-photo';
import { uploadStudentDocument } from '@/lib/upload-document';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DynamicFormFields } from '@/components/forms/dynamic-form-fields';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Program {
  id: string;
  name: string;
  branchId: string;
}

interface Batch {
  id: string;
  name: string;
  programId: string;
}

interface LookupStatus {
  id: string;
  code: string;
  label: string;
}

export default function NewStudentPage() {
  const router = useRouter();
  const { session, user } = useAuth();
  const token = session?.access_token;

  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cnicOrBForm, setCnicOrBForm] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File>>({});

  const { data: formFields } = useQuery({
    queryKey: ['form-fields'],
    queryFn: () =>
      apiClient<{
        data: Array<{
          id: string;
          code: string;
          label: string;
          fieldType: string;
          options?: string[] | null;
          isRequired: boolean;
        }>;
      }>('/form-fields', { token }),
    enabled: !!token,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: Branch[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

  const { data: programs } = useQuery({
    queryKey: ['programs', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Program[] }>(`/programs?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: batches } = useQuery({
    queryKey: ['batches', effectiveBranchId, programId],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(
        `/batches?branchId=${effectiveBranchId}${programId ? `&programId=${programId}` : ''}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: lookups } = useQuery({
    queryKey: ['lookups', 'student_status'],
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/student_status'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient<{ id: string }>('/students', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: async (created) => {
      if (photoFile) {
        try {
          const url = await uploadStudentPhoto(photoFile, created.id);
          await apiClient(`/students/${created.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ photographUrl: url }),
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Photo upload failed');
        }
      }
      const fileEntries = Object.entries(customFieldFiles);
      if (fileEntries.length > 0) {
        try {
          const uploaded: Record<string, string> = {};
          for (const [code, file] of fileEntries) {
            const { path } = await uploadStudentDocument(file, created.id);
            uploaded[code] = path;
          }
          await apiClient(`/students/${created.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({
              customFields: { ...customFieldValues, ...uploaded },
            }),
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'File upload failed');
        }
      }
      toast.success('Student admitted successfully');
      router.push('/dashboard/students');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create student'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBranchId || !statusId || !fullName.trim()) {
      toast.error('Please fill required fields');
      return;
    }
    createMutation.mutate({
      branchId: effectiveBranchId,
      fullName: fullName.trim(),
      statusId,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(cnicOrBForm ? { cnicOrBForm } : {}),
      ...(address ? { address } : {}),
      ...(gender ? { gender } : {}),
      ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth).toISOString() } : {}),
      ...(programId ? { programId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(Object.keys(customFieldValues).length > 0
        ? {
            customFields: Object.fromEntries(
              Object.entries(customFieldValues).filter(
                ([code]) => !customFieldFiles[code],
              ),
            ),
          }
        : {}),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Admit Student" description="Create a new student record" />

      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!user?.branchId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setProgramId('');
                    setBatchId('');
                  }}
                  required
                >
                  <option value="">Select branch</option>
                  {branches?.data.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Full name *</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">CNIC / B-Form</label>
                <Input value={cnicOrBForm} onChange={(e) => setCnicOrBForm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gender</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date of birth</label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Program</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setBatchId('');
                  }}
                >
                  <option value="">—</option>
                  {programs?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Batch</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  <option value="">—</option>
                  {batches?.data
                    .filter((b) => !programId || b.programId === programId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Photograph</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status *</label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                required
              >
                <option value="">Select status</option>
                {lookups?.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <DynamicFormFields
              fields={formFields?.data ?? []}
              values={customFieldValues}
              onChange={(code, value) =>
                setCustomFieldValues((prev) => ({ ...prev, [code]: value }))
              }
              onFileChange={(code, file) =>
                setCustomFieldFiles((prev) => {
                  const next = { ...prev };
                  if (file) next[code] = file;
                  else delete next[code];
                  return next;
                })
              }
            />

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Admit student'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
