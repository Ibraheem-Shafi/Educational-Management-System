'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZodSchema } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, GraduationCap, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createStudentSchema, updateStudentSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePageBranchScopeOptional } from '@/hooks/use-page-branch-scope';
import { apiClient, ApiClientError } from '@/lib/api-client';
import {
  normalizePakistanPhone,
  validateSchema,
  flattenFieldErrors,
  mapApiDetailsToFields,
} from '@/lib/form-validation';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useBatches } from '@/hooks/use-batches';
import { FormFieldError } from '@/components/forms/form-field-error';
import { uploadStudentPhoto } from '@/lib/upload-photo';
import { ACCEPT_IMAGE_NO_GIF, assertAllowedImage } from '@/lib/image-upload';
import { uploadStudentDocument } from '@/lib/upload-document';
import { DynamicFormFields } from '@/components/forms/dynamic-form-fields';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { UserAvatar } from '@/components/layout/user-avatar';
import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { CnicInput } from '@/components/ui/cnic-input';
import { PakistanPhoneInput } from '@/components/ui/pakistan-phone-input';
import {
  AdmitFieldGrid,
  AdmitStudentSection,
  AdmitStudentSideNav,
  type AdmitStudentSectionId,
} from '@/components/features/students/admit-student-side-nav';
import { queryKeys } from '@/lib/query-keys';
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

export function AdmitStudentForm({ studentId }: { studentId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inquiryId = searchParams.get('inquiryId');
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const token = session?.access_token;
  const formRef = useRef<HTMLFormElement>(null);
  const inquiryPrefilledRef = useRef(false);
  const isEditing = !!studentId;
  const editPrefilledRef = useRef(false);
  const feeFieldsOnly = useMemo(() => {
    if (!isEditing || !user?.roles?.length) return false;
    const privileged =
      user.roles.includes('super_admin') || user.roles.includes('branch_admin');
    return user.roles.includes('accountant') && !privileged;
  }, [isEditing, user?.roles]);
  const schema = useMemo(
    (): ZodSchema => (isEditing ? updateStudentSchema : createStudentSchema),
    [isEditing],
  );
  const {
    errors,
    validate,
    clearField,
    setFieldError,
    fieldClassName,
    applyApiErrors,
  } = useFormErrors(schema);

  const [activeSection, setActiveSection] = useState<AdmitStudentSectionId>('student-information');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [monthlyFeeDiscount, setMonthlyFeeDiscount] = useState('');
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
    queryFn: () => apiClient<{ data: Branch[] }>('/branches/options', { token }),
    enabled: !!token,
  });

  // Preselect the scoped branch when the effective scope is a single branch;
  // otherwise require an explicit pick (no first-branch fallback).
  const pageScope = usePageBranchScopeOptional();
  const scopedSingleBranchId = pageScope?.singleBranchId ?? null;
  const effectiveBranchId = branchId || user?.branchId || scopedSingleBranchId || '';

  const { data: programs } = useQuery({
    queryKey: ['programs-options', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Program[] }>(`/programs/options?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: batches } = useBatches(
    token,
    effectiveBranchId,
    programId || undefined,
    !!effectiveBranchId,
  );

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

  const { data: editingStudent } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () =>
      apiClient<{
        id: string;
        fullName: string;
        phone: string | null;
        email: string | null;
        cnicOrBForm: string | null;
        address: string | null;
        gender: string | null;
        dateOfBirth: string | null;
        photographUrl: string | null;
        rollNumber?: string | null;
        admissionNumber?: string | null;
        monthlyFeeDiscount?: number | null;
        branchId: string;
        programId?: string | null;
        batchId?: string | null;
        statusId?: string | null;
        customFields?: Record<string, string | boolean> | null;
      }>(`/students/${studentId}`, { token }),
    enabled: !!token && isEditing,
  });

  useEffect(() => {
    if (!editingStudent || editPrefilledRef.current) return;
    setFullName(editingStudent.fullName ?? '');
    setRollNumber(editingStudent.rollNumber ?? '');
    setAdmissionNumber(editingStudent.admissionNumber ?? '');
    setMonthlyFeeDiscount(
      editingStudent.monthlyFeeDiscount && editingStudent.monthlyFeeDiscount > 0
        ? String(editingStudent.monthlyFeeDiscount)
        : '',
    );
    setPhone(editingStudent.phone ?? '');
    setEmail(editingStudent.email ?? '');
    setCnicOrBForm(editingStudent.cnicOrBForm ?? '');
    setAddress(editingStudent.address ?? '');
    setGender(editingStudent.gender ?? '');
    setDateOfBirth(editingStudent.dateOfBirth ? editingStudent.dateOfBirth.slice(0, 10) : '');
    if (editingStudent.branchId) setBranchId(editingStudent.branchId);
    if (editingStudent.programId) setProgramId(editingStudent.programId);
    if (editingStudent.batchId) setBatchId(editingStudent.batchId);
    if (editingStudent.statusId) setStatusId(editingStudent.statusId);
    if (editingStudent.customFields) {
      setCustomFieldValues(
        Object.fromEntries(
          Object.entries(editingStudent.customFields).filter(([, v]) => typeof v !== 'object'),
        ) as Record<string, string | boolean>,
      );
    }
    editPrefilledRef.current = true;
  }, [editingStudent]);

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
      apiClient<{ id: string }>(isEditing ? `/students/${studentId}` : '/students', {
        method: isEditing ? 'PATCH' : 'POST',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: async (created) => {
      if (isEditing) created = { id: studentId! };
      if (photoFile && !feeFieldsOnly) {
        try {
          const url = await uploadStudentPhoto(photoFile, created.id, token!);
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
            const { path } = await uploadStudentDocument(
              file,
              created.id,
              effectiveBranchId,
              token!,
            );
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
      toast.success(isEditing ? 'Student updated successfully' : 'Student admitted successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student', created.id] }),
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.studentsStats }),
        queryClient.invalidateQueries({ queryKey: ['student-parents', created.id] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.studentsRecent }),
      ]);
      router.push(isEditing ? `/dashboard/students/${studentId}` : '/dashboard/students');
    },
    onError: (err: Error) => {
      if (err instanceof ApiClientError && applyApiErrors(err.details)) {
        const fieldErrors = mapApiDetailsToFields(err.details);
        const messages = Object.values(fieldErrors);
        const firstField = Object.keys(fieldErrors)[0] ?? null;
        scrollToErrorSection(firstField);
        if (messages.length === 1) {
          toast.error(messages[0]!);
        } else if (messages.length > 1) {
          toast.error(
            `Please fix ${messages.length} validation errors: ${messages.slice(0, 3).join('; ')}${
              messages.length > 3 ? '…' : ''
            }`,
          );
        } else {
          toast.error(err.message || 'Validation failed');
        }
        return;
      }
      toast.error(err.message || (isEditing ? 'Failed to update student' : 'Failed to create student'));
    },
  });

  const scrollToErrorSection = useCallback(
    (field: string | null) => {
      if (!field) return;
      const isCustomField = (formFields?.data ?? []).some((f) => f.code === field);
      if (['fullName', 'gender', 'dateOfBirth', 'cnicOrBForm', 'branchId', 'statusId'].includes(field)) {
        scrollToSection('student-information');
      } else if (['phone', 'email', 'address'].includes(field)) {
        scrollToSection('contact-information');
      } else if (['programId', 'batchId'].includes(field) || isCustomField) {
        // Custom/additional fields render under Academic Information.
        scrollToSection('academic-information');
      } else if (
        field.startsWith('guardian') ||
        ['guardianFullName', 'guardianPhone', 'guardianEmail', 'guardianCnic'].includes(field)
      ) {
        scrollToSection('guardian-details');
      } else if (field.startsWith('emergency') || ['emergencyFullName', 'emergencyPhone'].includes(field)) {
        scrollToSection('emergency-contact');
      }
    },
    [formFields?.data, scrollToSection],
  );

  const buildGuardians = () => {
    const guardians = [];
    if (guardian.fullName.trim()) {
      guardians.push({
        fullName: guardian.fullName.trim(),
        relationshipCode: guardian.relationshipCode,
        ...(guardian.phone.trim()
          ? { phone: normalizePakistanPhone(guardian.phone.trim()) }
          : {}),
        ...(guardian.email.trim() ? { email: guardian.email.trim() } : {}),
        ...(guardian.cnic.trim() ? { cnic: guardian.cnic.trim() } : {}),
        ...(guardian.address.trim() ? { address: guardian.address.trim() } : {}),
      });
    }
    if (emergency.fullName.trim()) {
      guardians.push({
        fullName: emergency.fullName.trim(),
        relationshipCode: 'guardian' as const,
        ...(emergency.phone.trim()
          ? { phone: normalizePakistanPhone(emergency.phone.trim()) }
          : {}),
      });
    }
    return guardians.length ? guardians : undefined;
  };

  const buildPayload = () => {
    if (feeFieldsOnly) {
      return {
        ...(monthlyFeeDiscount.trim() !== ''
          ? { monthlyFeeDiscount: Number(monthlyFeeDiscount) }
          : { monthlyFeeDiscount: 0 }),
        ...(programId ? { programId } : {}),
        ...(batchId ? { batchId } : {}),
      };
    }
    const guardians = buildGuardians();
    const base: Record<string, unknown> = {
      fullName: fullName.trim(),
      statusId,
      ...(rollNumber.trim() ? { rollNumber: rollNumber.trim() } : {}),
      ...(admissionNumber.trim() ? { admissionNumber: admissionNumber.trim() } : {}),
      ...(monthlyFeeDiscount.trim() !== ''
        ? { monthlyFeeDiscount: Number(monthlyFeeDiscount) }
        : isEditing
          ? { monthlyFeeDiscount: 0 }
          : {}),
      ...(phone.trim() ? { phone: normalizePakistanPhone(phone.trim()) } : {}),
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
      ...(guardians ? { guardians } : {}),
    };
    if (isEditing) return base;
    return { branchId: effectiveBranchId, ...base };
  };

  const validateCustomFields = useCallback((): Record<string, string> => {
    const defs = formFields?.data ?? [];
    const customErrors: Record<string, string> = {};
    for (const field of defs) {
      if (!field.isRequired) continue;
      if (field.fieldType === 'file') {
        const hasNewFile = !!customFieldFiles[field.code];
        const existing = customFieldValues[field.code];
        const hasExisting =
          typeof existing === 'string' && existing.trim().length > 0;
        // On edit, an already-uploaded path in customFields satisfies the requirement.
        if (!hasNewFile && !hasExisting) {
          const message = `${field.label} is required`;
          setFieldError(field.code, message);
          customErrors[field.code] = message;
        }
        continue;
      }
      if (field.fieldType === 'checkbox') {
        if (!customFieldValues[field.code]) {
          const message = `${field.label} is required`;
          setFieldError(field.code, message);
          customErrors[field.code] = message;
        }
        continue;
      }
      const value = String(customFieldValues[field.code] ?? '').trim();
      if (!value) {
        const message = `${field.label} is required`;
        setFieldError(field.code, message);
        customErrors[field.code] = message;
      }
    }
    return customErrors;
  }, [customFieldFiles, customFieldValues, formFields?.data, setFieldError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (feeFieldsOnly) {
      if (
        monthlyFeeDiscount.trim() !== '' &&
        (Number.isNaN(Number(monthlyFeeDiscount)) || Number(monthlyFeeDiscount) < 0)
      ) {
        setFieldError('monthlyFeeDiscount', 'Enter a valid discount amount');
        toast.error('Enter a valid discount amount');
        return;
      }
      createMutation.mutate(payload);
      return;
    }
    const schemaResult = validateSchema(schema, payload);
    const schemaErrors = schemaResult.success
      ? ({} as Record<string, string>)
      : flattenFieldErrors(schemaResult.fieldErrors);
    // Keep field-level UI errors in sync with schema validation.
    validate(payload);
    const customErrors = validateCustomFields();
    const allErrors = { ...schemaErrors, ...customErrors };
    const errorMessages = Object.values(allErrors).filter(Boolean);

    if (errorMessages.length > 0) {
      const firstError = Object.keys(allErrors)[0] ?? null;
      if (firstError) scrollToErrorSection(firstError);

      if (errorMessages.length === 1) {
        toast.error(errorMessages[0]!);
      } else {
        toast.error(
          `Please fix ${errorMessages.length} validation errors: ${errorMessages.slice(0, 3).join('; ')}${
            errorMessages.length > 3 ? '…' : ''
          }`,
        );
      }
      return;
    }

    createMutation.mutate(payload);
  };

  const updateGuardian = (key: keyof typeof guardian, value: string) => {
    setGuardian((prev) => ({ ...prev, [key]: value }));
    const fieldMap: Partial<Record<keyof typeof guardian, string>> = {
      fullName: 'guardianFullName',
      phone: 'guardianPhone',
      email: 'guardianEmail',
      cnic: 'guardianCnic',
    };
    const errorField = fieldMap[key];
    if (errorField) clearField(errorField);
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
              <span className="font-medium text-[var(--text-main-900)]">
                {feeFieldsOnly ? 'Edit fee settings' : isEditing ? 'Edit Student' : 'Add Student'}
              </span>
            </nav>
            <p className="mt-1 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
              {feeFieldsOnly
                ? 'Update monthly discount, program, and batch only.'
                : isEditing
                  ? 'Update this student record.'
                  : inquiryId
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
            {createMutation.isPending
              ? isEditing
                ? 'Saving…'
                : 'Adding…'
              : isEditing
                ? 'Save changes'
                : 'Add'}
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
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="min-w-0 flex-1 space-y-5">
          {feeFieldsOnly ? (
            <AdmitStudentSection
              id="academic-information"
              title="Fee settings"
              description="Monthly discount and class placement used for fee billing."
            >
              <AdmitFieldGrid>
                <div>
                  <FormFieldLabel>Monthly fee discount (Rs)</FormFieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className={fieldClassName('monthlyFeeDiscount', modalFieldClassName)}
                    placeholder="e.g. 2000"
                    value={monthlyFeeDiscount}
                    onChange={(e) => {
                      setMonthlyFeeDiscount(e.target.value);
                      clearField('monthlyFeeDiscount');
                    }}
                  />
                  <p className="mt-1 text-xs text-[var(--base-muted-foreground,#71717A)]">
                    Fixed amount off monthly tuition on every new monthly invoice.
                  </p>
                  <FormFieldError message={errors.monthlyFeeDiscount} />
                </div>
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
                      ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                    ]}
                  />
                </div>
              </AdmitFieldGrid>
            </AdmitStudentSection>
          ) : (
            <>
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
                  Min 400x400px. Images only (GIF not allowed)
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
                    accept={ACCEPT_IMAGE_NO_GIF}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      if (!file) {
                        setPhotoFile(null);
                        return;
                      }
                      try {
                        assertAllowedImage(file);
                        setPhotoFile(file);
                      } catch (err) {
                        setPhotoFile(null);
                        toast.error(err instanceof Error ? err.message : 'Invalid image');
                      }
                    }}
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
                  value={branchId || scopedSingleBranchId || ''}
                  onValueChange={(value) => {
                    setBranchId(value);
                    setProgramId('');
                    setBatchId('');
                    clearField('branchId');
                  }}
                  options={[
                    { value: '', label: 'Select branch' },
                    ...(branches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                  ]}
                />
                <FormFieldError message={errors.branchId} />
              </div>
            ) : null}

            <AdmitFieldGrid>
              <div>
                <FormFieldLabel required>Full Name</FormFieldLabel>
                <input
                  className={fieldClassName('fullName', modalFieldClassName)}
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearField('fullName');
                  }}
                />
                <FormFieldError message={errors.fullName} />
              </div>
              <div>
                <FormFieldLabel>Roll number</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="e.g. 001"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>Admission number</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="e.g. ADM-2026-001"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                />
              </div>
              <div>
                <FormFieldLabel>Monthly fee discount (Rs)</FormFieldLabel>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className={fieldClassName('monthlyFeeDiscount', modalFieldClassName)}
                  placeholder="e.g. 2000"
                  value={monthlyFeeDiscount}
                  onChange={(e) => {
                    setMonthlyFeeDiscount(e.target.value);
                    clearField('monthlyFeeDiscount');
                  }}
                />
                <p className="mt-1 text-xs text-[var(--base-muted-foreground,#71717A)]">
                  Fixed amount off monthly tuition on every new monthly invoice.
                </p>
                <FormFieldError message={errors.monthlyFeeDiscount} />
              </div>
              <div>
                <FormFieldLabel>Gender</FormFieldLabel>
                <SelectDropdown
                  fullWidth
                  aria-label="Gender"
                  placeholder="Select gender"
                  value={gender}
                  onValueChange={(value) => {
                    setGender(value);
                    clearField('gender');
                  }}
                  options={[
                    { value: '', label: 'Select gender' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
                <FormFieldError message={errors.gender} />
              </div>
              <div>
                <FormFieldLabel>Date of Birth</FormFieldLabel>
                <input
                  type="date"
                  className={fieldClassName('dateOfBirth', modalFieldClassName)}
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    clearField('dateOfBirth');
                  }}
                />
                <FormFieldError message={errors.dateOfBirth} />
              </div>
              <div>
                <FormFieldLabel>CNIC / B-Form</FormFieldLabel>
                <CnicInput
                  className={fieldClassName('cnicOrBForm', modalFieldClassName)}
                  value={cnicOrBForm}
                  onChange={(value) => {
                    setCnicOrBForm(value);
                    clearField('cnicOrBForm');
                  }}
                />
                <FormFieldError message={errors.cnicOrBForm} />
              </div>
            </AdmitFieldGrid>

            <div>
              <FormFieldLabel required>Status</FormFieldLabel>
              <SelectDropdown
                fullWidth
                aria-label="Status"
                placeholder="Select status"
                value={statusId}
                onValueChange={(value) => {
                  setStatusId(value);
                  clearField('statusId');
                }}
                options={[
                  { value: '', label: 'Select status' },
                  ...(lookups?.statuses.map((s) => ({ value: s.id, label: s.label })) ?? []),
                ]}
              />
              <FormFieldError message={errors.statusId} />
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
                <PakistanPhoneInput
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    clearField('phone');
                  }}
                  className={errors.phone ? 'border-red-500' : undefined}
                />
                <FormFieldError message={errors.phone} />
              </div>
              <div>
                <FormFieldLabel>Email Address</FormFieldLabel>
                <input
                  type="email"
                  className={fieldClassName('email', modalFieldClassName)}
                  placeholder="student@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearField('email');
                  }}
                />
                <FormFieldError message={errors.email} />
              </div>
            </AdmitFieldGrid>
            <div>
              <FormFieldLabel>Address</FormFieldLabel>
              <input
                className={fieldClassName('address', modalFieldClassName)}
                placeholder="House No, Street"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearField('address');
                }}
              />
              <FormFieldError message={errors.address} />
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
                    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                  ]}
                />
              </div>
            </AdmitFieldGrid>

            <DynamicFormFields
              fields={formFields?.data ?? []}
              values={customFieldValues}
              errors={errors}
              clearField={clearField}
              fieldClassName={fieldClassName}
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
                  className={fieldClassName('guardianFullName', modalFieldClassName)}
                  placeholder="Enter guardian's full name"
                  value={guardian.fullName}
                  onChange={(e) => updateGuardian('fullName', e.target.value)}
                />
                <FormFieldError message={errors.guardianFullName} />
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
                <PakistanPhoneInput
                  value={guardian.phone}
                  onChange={(value) => updateGuardian('phone', value)}
                  className={errors.guardianPhone ? 'border-red-500' : undefined}
                />
                <FormFieldError message={errors.guardianPhone} />
              </div>
              <div>
                <FormFieldLabel>Email</FormFieldLabel>
                <input
                  type="email"
                  className={fieldClassName('guardianEmail', modalFieldClassName)}
                  placeholder="guardian@email.com"
                  value={guardian.email}
                  onChange={(e) => updateGuardian('email', e.target.value)}
                />
                <FormFieldError message={errors.guardianEmail} />
              </div>
              <div>
                <FormFieldLabel>CNIC</FormFieldLabel>
                <CnicInput
                  className={fieldClassName('guardianCnic', modalFieldClassName)}
                  value={guardian.cnic}
                  onChange={(value) => updateGuardian('cnic', value)}
                />
                <FormFieldError message={errors.guardianCnic} />
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
                  className={fieldClassName('emergencyFullName', modalFieldClassName)}
                  placeholder="Enter contact name"
                  value={emergency.fullName}
                  onChange={(e) => {
                    setEmergency((prev) => ({ ...prev, fullName: e.target.value }));
                    clearField('emergencyFullName');
                  }}
                />
                <FormFieldError message={errors.emergencyFullName} />
              </div>
              <div>
                <FormFieldLabel>Mobile Number</FormFieldLabel>
                <PakistanPhoneInput
                  value={emergency.phone}
                  onChange={(value) => {
                    setEmergency((prev) => ({ ...prev, phone: value }));
                    clearField('emergencyPhone');
                  }}
                  className={errors.emergencyPhone ? 'border-red-500' : undefined}
                />
                <FormFieldError message={errors.emergencyPhone} />
              </div>
            </AdmitFieldGrid>
          </AdmitStudentSection>
            </>
          )}

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
              {createMutation.isPending
                ? isEditing
                  ? 'Saving…'
                  : 'Adding…'
                : isEditing
                  ? 'Save changes'
                  : 'Add'}
            </button>
          </div>
        </form>

        {!feeFieldsOnly ? (
          <AdmitStudentSideNav
            activeSection={activeSection}
            completedSections={completedSections}
            onNavigate={scrollToSection}
          />
        ) : null}
      </div>
    </div>
  );
}
