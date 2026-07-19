'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { publicInquirySchema } from '@eims/shared';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { FormFieldError } from '@/components/forms/form-field-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { cn } from '@/lib/utils';

interface PublicBranch {
  id: string;
  name: string;
  code: string;
  city: string | null;
}

const fieldClass =
  'w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm';

export default function PublicApplyPage() {
  const [form, setForm] = useState({
    branchId: '',
    fullName: '',
    phone: '',
    email: '',
    programInterest: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const { errors, clearField, validate, applyApiErrors, fieldClassName } =
    useFormErrors(publicInquirySchema);

  const { data: institution } = useQuery({
    queryKey: ['public-institution'],
    queryFn: () =>
      apiClient<{ name: string; logoUrl: string | null }>('/settings/institution'),
  });

  const { data: branches } = useQuery({
    queryKey: ['public-branches'],
    queryFn: () => apiClient<{ data: PublicBranch[] }>('/public/branches'),
  });

  const submit = useMutation({
    mutationFn: (payload: {
      branchId: string;
      fullName: string;
      phone: string;
      email?: string;
      programInterest?: string;
      notes?: string;
    }) =>
      apiClient<{ message: string }>('/public/inquiries', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setSubmitted(true);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to submit inquiry');
    },
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(key);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f8fafc_0%,#e8eef5_45%,#f1f5f9_100%)] px-4 py-10 font-[family-name:var(--font-inter)]">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          {institution?.logoUrl && !institution.logoUrl.startsWith('storage://') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institution.logoUrl}
              alt=""
              className="mx-auto mb-3 h-14 object-contain"
            />
          )}
          <h1 className="text-2xl font-semibold text-[var(--midnight-blue-950,#01366C)]">
            {institution?.name ?? 'Admission inquiry'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-sub-500,#525866)]">
            Submit an admission inquiry. Our front office will follow up with you.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-6 shadow-sm">
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-base font-medium text-[var(--text-main-900)]">Inquiry received</p>
              <p className="text-sm text-[var(--text-sub-500,#525866)]">
                Thank you. Our team will contact you soon.
              </p>
              <Link
                href="/login"
                className="inline-flex text-sm font-medium text-[var(--midnight-blue-950,#01366C)] underline"
              >
                Staff / parent login
              </Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const payload = {
                  branchId: form.branchId,
                  fullName: form.fullName.trim(),
                  phone: form.phone.trim(),
                  email: form.email.trim(),
                  programInterest: form.programInterest.trim() || undefined,
                  notes: form.notes.trim() || undefined,
                };
                if (!validate(payload)) return;
                submit.mutate({
                  ...payload,
                  email: payload.email || undefined,
                });
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium">Branch</label>
                <select
                  className={fieldClassName('branchId', fieldClass)}
                  value={form.branchId}
                  onChange={(e) => updateField('branchId', e.target.value)}
                >
                  <option value="">Select branch</option>
                  {(branches?.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.city ? ` (${b.city})` : ''}
                    </option>
                  ))}
                </select>
                <FormFieldError message={errors.branchId} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Full name</label>
                <input
                  className={fieldClassName('fullName', fieldClass)}
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                />
                <FormFieldError message={errors.fullName} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone</label>
                <input
                  className={fieldClassName('phone', fieldClass)}
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
                <FormFieldError message={errors.phone} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email (optional)</label>
                <input
                  type="email"
                  className={fieldClassName('email', fieldClass)}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
                <FormFieldError message={errors.email} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Program interest</label>
                <input
                  className={fieldClassName('programInterest', fieldClass)}
                  value={form.programInterest}
                  onChange={(e) => updateField('programInterest', e.target.value)}
                  placeholder="e.g. Matric, Intermediate, Coaching"
                />
                <FormFieldError message={errors.programInterest} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes</label>
                <textarea
                  className={cn(fieldClassName('notes', fieldClass), 'resize-y')}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
                <FormFieldError message={errors.notes} />
              </div>
              <button
                type="submit"
                disabled={submit.isPending}
                className="w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submit.isPending ? 'Submitting…' : 'Submit inquiry'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-sub-500,#525866)]">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[var(--midnight-blue-950,#01366C)] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
