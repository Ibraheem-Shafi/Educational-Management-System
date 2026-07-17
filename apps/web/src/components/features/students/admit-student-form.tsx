'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, GraduationCap, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadStudentPhoto } from '@/lib/upload-photo';
import { uploadStudentDocument } from '@/lib/upload-document';
import { DynamicFormFields } from '@/components/forms/dynamic-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { UserAvatar } from '@/components/layout/user-avatar';
import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import {
  AdmitFieldGrid,
  AdmitStudentSection,
  AdmitStudentSideNav,
  type AdmitStudentSectionId,
} from '@/components/features/students/admit-student-side-nav';
import { cn } from '@/lib/utils';

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

const emptyGuardian = {
  fullName: '',
  relationshipCode: 'guardian' as const,
  phone: '',
  email: '',
  cnic: '',
  address: '',
};

const emptyEmergency = {
  fullName: '',
  phone: '',
};

export function AdmitStudentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inquiryId = searchParams.get('inquiryId');
  const { session, user } = useAuth();
  const token = session?.access_token;
  const formRef = useRef<HTMLFormElement>(null);
  const inquiryPrefilledRef = useRef(false);

  const [activeSection, setActiveSection] = useState<AdmitStudentSectionId>('student-information');
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean>>({});
  const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File>>({});
  const [guardian, setGuardian] = useState(emptyGuardian);
  const [emergency, setEmergency] = useState(emptyEmergency);

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

  const { data: inquiryConvert } = useQuery({
    queryKey: ['inquiry-convert', inquiryId],
    queryFn: () =>
      apiClient<{
        inquiry: {
          id: string;
          branchId: string;
          fullName: string;
          phone: string | null;
          email: string | null;
        };
      }>(`/inquiries/${inquiryId}/convert`, { token }),
    enabled: !!token && !!inquiryId,
  });

  useEffect(() => {
    if (!inquiryConvert?.inquiry || inquiryPrefilledRef.current) return;
    const inquiry = inquiryConvert.inquiry;
    setFullName(inquiry.fullName);
    setPhone(inquiry.phone ?? '');
    setEmail(inquiry.email ?? '');
    if (inquiry.branchId) setBranchId(inquiry.branchId);
    inquiryPrefilledRef.current = true;
  }, [inquiryConvert]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const completedSections = useMemo(() => {
    const done = new Set<AdmitStudentSectionId>();
    if (fullName.trim() && statusId && effectiveBranchId) {
      done.add('student-information');
    }
    if (phone.trim() || email.trim() || address.trim()) {
      done.add('contact-information');
    }
    if (programId || batchId) {
      done.add('academic-information');
    }
    if (guardian.fullName.trim()) {
      done.add('guardian-details');
    }
    if (emergency.fullName.trim() && emergency.phone.trim()) {
      done.add('emergency-contact');
    }
    return done;
  }, [
    fullName,
    statusId,
    effectiveBranchId,
    phone,
    email,
    address,
    programId,
    batchId,
    guardian.fullName,
    emergency.fullName,
    emergency.phone,
  ]);

  const scrollToSection = useCallback((id: AdmitStudentSectionId) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  }, []);

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
      if (inquiryId) {
        try {
          await apiClient(`/inquiries/${inquiryId}/convert`, {
            method: 'POST',
            token,
            body: { studentId: created.id },
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Student created but inquiry link failed',
          );
        }
      }
      toast.success('Student admitted successfully');
      router.push('/dashboard/students');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create student'),
  });

  const buildGuardians = () => {
    const guardians = [];
    if (guardian.fullName.trim()) {
      guardians.push({
        fullName: guardian.fullName.trim(),
        relationshipCode: guardian.relationshipCode,
        ...(guardian.phone.trim() ? { phone: guardian.phone.trim() } : {}),
        ...(guardian.email.trim() ? { email: guardian.email.trim() } : {}),
        ...(guardian.cnic.trim() ? { cnic: guardian.cnic.trim() } : {}),
        ...(guardian.address.trim() ? { address: guardian.address.trim() } : {}),
      });
    }
    if (emergency.fullName.trim()) {
      guardians.push({
        fullName: emergency.fullName.trim(),
        relationshipCode: 'guardian' as const,
        ...(emergency.phone.trim() ? { phone: emergency.phone.trim() } : {}),
      });
    }
    return guardians.length ? guardians : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBranchId || !statusId || !fullName.trim()) {
      toast.error('Please fill required student fields');
      scrollToSection('student-information');
      return;
    }

    if (guardian.fullName.trim() && !guardian.relationshipCode) {
      toast.error('Select guardian relationship');
      scrollToSection('guardian-details');
      return;
    }

    createMutation.mutate({
      branchId: effectiveBranchId,
      fullName: fullName.trim(),
      statusId,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(cnicOrBForm.trim() ? { cnicOrBForm: cnicOrBForm.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(gender ? { gender } : {}),
      ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth).toISOString() } : {}),
      ...(programId ? { programId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(Object.keys(customFieldValues).length > 0
        ? {
            customFields: Object.fromEntries(
              Object.entries(customFieldValues).filter(([code]) => !customFieldFiles[code]),
            ),
          }
        : {}),
      ...(buildGuardians() ? { guardians: buildGuardians() } : {}),
    });
  };

  const updateGuardian = (key: keyof typeof guardian, value: string) => {
    setGuardian((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <GraduationCap className="h-[18px] w-[18px] text-[var(--text-main-900)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <nav className="flex flex-wrap items-center gap-1.5 text-sm leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
              <Link href="/dashboard/students" className="hover:text-[var(--text-main-900)]">
                Students
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--text-soft-400,#868C98)]" />
              <span className="font-medium text-[var(--text-main-900)]">Add Student</span>
            </nav>
            <p className="mt-1 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
              {inquiryId
                ? 'Admit student from admission inquiry.'
                : 'Create a new student record.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-4',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]',
            )}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={createMutation.isPending}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {createMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {inquiryId && inquiryConvert?.inquiry ? (
        <div className="rounded-xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-50)] px-4 py-3 text-sm text-[var(--text-sub-500,#525866)]">
          Prefilled from inquiry for{' '}
          <span className="font-medium text-[var(--text-main-900)]">
            {inquiryConvert.inquiry.fullName}
          </span>
          . Saving will link this student to the inquiry.
        </div>
      ) : null}

      <div className="flex items-start gap-8">
        <form ref={formRef} onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-5">
          <AdmitStudentSection
            id="student-information"
            title="Basic Information"
            description="Enter the student's personal details."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar
                name={fullName || 'Student'}
                src={photoPreview}
                gender={gender}
                size="lg"
                className="h-20 w-20"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium leading-5 text-[var(--text-main-900)]">
                  Upload student photo
                </p>
                <p className="text-xs leading-4 text-[var(--text-sub-500,#525866)]">
                  Min 400x400px, PNG or JPEG
                </p>
                <label
                  className={cn(
                    'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3',
                    'text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]',
                  )}
                >
                  <Upload className="h-4 w-4" strokeWidth={1.5} />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            {!user?.branchId ? (
              <div>
                <FormFieldLabel required>Branch</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Branch"
                  placeholder="Select branch"
                  value={branchId}
                  onValueChange={(value) => {
                    setBranchId(value);
                    setProgramId('');
                    setBatchId('');
                  }}
                  options={[
                    { value: '', label: 'Select branch' },
                    ...(branches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                  ]}
                />
              </div>
            ) : null}

            <AdmitFieldGrid>
              <div>
                <FormFieldLabel required>Full Name</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <FormFieldLabel>Gender</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Gender"
                  placeholder="Select gender"
                  value={gender}
                  onValueChange={setGender}
                  options={[
                    { value: '', label: 'Select gender' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <div>
                <FormFieldLabel>Date of Birth</FormFieldLabel>
                <input
                  type="date"
                  className={modalFieldClassName}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>CNIC / B-Form</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="XXXXX-XXXXXXX-X"
                  value={cnicOrBForm}
                  onChange={(e) => setCnicOrBForm(e.target.value)}
                />
              </div>
            </AdmitFieldGrid>

            <div>
              <FormFieldLabel required>Status</FormFieldLabel>
              <SelectDropdown
                fullWidth
                aria-label="Status"
                placeholder="Select status"
                value={statusId}
                onValueChange={setStatusId}
                options={[
                  { value: '', label: 'Select status' },
                  ...(lookups?.statuses.map((s) => ({ value: s.id, label: s.label })) ?? []),
                ]}
              />
            </div>
          </AdmitStudentSection>

          <AdmitStudentSection
            id="contact-information"
            title="Contact Information"
            description="How can we reach the student?"
          >
            <AdmitFieldGrid>
              <div>
                <FormFieldLabel>Mobile Number</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>Email Address</FormFieldLabel>
                <input
                  type="email"
                  className={modalFieldClassName}
                  placeholder="student@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </AdmitFieldGrid>
            <div>
              <FormFieldLabel>Address</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="House No, Street"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </AdmitStudentSection>

          <AdmitStudentSection
            id="academic-information"
            title="Academic Information"
            description="Assign program and batch for the student."
          >
            <AdmitFieldGrid>
              <div>
                <FormFieldLabel>Program</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Program"
                  placeholder="Select program"
                  value={programId}
                  onValueChange={(value) => {
                    setProgramId(value);
                    setBatchId('');
                  }}
                  options={[
                    { value: '', label: 'Select program' },
                    ...(programs?.data.map((p) => ({ value: p.id, label: p.name })) ?? []),
                  ]}
                />
              </div>
              <div>
                <FormFieldLabel>Batch</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Batch"
                  placeholder="Select batch"
                  value={batchId}
                  onValueChange={setBatchId}
                  options={[
                    { value: '', label: 'Select batch' },
                    ...(batches?.data
                      .filter((b) => !programId || b.programId === programId)
                      .map((b) => ({ value: b.id, label: b.name })) ?? []),
                  ]}
                />
              </div>
            </AdmitFieldGrid>

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
          </AdmitStudentSection>

          <AdmitStudentSection
            id="guardian-details"
            title="Primary Guardian"
            description="Add a parent or guardian for this student."
          >
            <AdmitFieldGrid>
              <div>
                <FormFieldLabel>Guardian Name</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Enter guardian's full name"
                  value={guardian.fullName}
                  onChange={(e) => updateGuardian('fullName', e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>Relationship</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Relationship"
                  placeholder="Select relationship"
                  value={guardian.relationshipCode}
                  onValueChange={(value) =>
                    updateGuardian(
                      'relationshipCode',
                      value as typeof guardian.relationshipCode,
                    )
                  }
                  options={[
                    { value: 'father', label: 'Father' },
                    { value: 'mother', label: 'Mother' },
                    { value: 'guardian', label: 'Guardian' },
                  ]}
                />
              </div>
              <div>
                <FormFieldLabel>Mobile Number</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="03XX-XXXXXXX"
                  value={guardian.phone}
                  onChange={(e) => updateGuardian('phone', e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>Email</FormFieldLabel>
                <input
                  type="email"
                  className={modalFieldClassName}
                  placeholder="guardian@email.com"
                  value={guardian.email}
                  onChange={(e) => updateGuardian('email', e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>CNIC</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="XXXXX-XXXXXXX-X"
                  value={guardian.cnic}
                  onChange={(e) => updateGuardian('cnic', e.target.value)}
                />
              </div>
            </AdmitFieldGrid>
            <div>
              <FormFieldLabel>Address</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="House No, Street"
                value={guardian.address}
                onChange={(e) => updateGuardian('address', e.target.value)}
              />
            </div>
          </AdmitStudentSection>

          <AdmitStudentSection
            id="emergency-contact"
            title="Emergency Contact"
            description="Optional alternate contact in case of emergency."
          >
            <AdmitFieldGrid>
              <div>
                <FormFieldLabel>Contact Name</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Enter contact name"
                  value={emergency.fullName}
                  onChange={(e) => setEmergency((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel>Mobile Number</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="03XX-XXXXXXX"
                  value={emergency.phone}
                  onChange={(e) => setEmergency((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </AdmitFieldGrid>
          </AdmitStudentSection>

          <div className="flex justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => router.back()}
              className={cn(
                'inline-flex h-10 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-5',
                'text-sm font-medium leading-5 text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]',
              )}
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-5',
                'text-sm font-medium leading-5 text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {createMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>

        <AdmitStudentSideNav
          activeSection={activeSection}
          completedSections={completedSections}
          onNavigate={scrollToSection}
        />
      </div>
    </div>
  );
}
