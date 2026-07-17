'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface PublicBranch {
  id: string;
  name: string;
  code: string;
  city: string | null;
}

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
    mutationFn: () =>
      apiClient<{ message: string }>('/public/inquiries', {
        method: 'POST',
        body: {
          branchId: form.branchId,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          programInterest: form.programInterest.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setSubmitted(true);
    },
    onError: (err: Error) => toast.error(err.message || 'Unable to submit inquiry'),
  });

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
                if (!form.branchId || !form.fullName.trim() || !form.phone.trim()) {
                  toast.error('Branch, name, and phone are required');
                  return;
                }
                submit.mutate();
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium">Branch</label>
                <select
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  value={form.branchId}
                  onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                  required
                >
                  <option value="">Select branch</option>
                  {(branches?.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.city ? ` (${b.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Full name</label>
                <input
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Phone</label>
                <input
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Email (optional)</label>
                <input
                  type="email"
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Program interest</label>
                <input
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  value={form.programInterest}
                  onChange={(e) => setForm((p) => ({ ...p, programInterest: e.target.value }))}
                  placeholder="e.g. Matric, Intermediate, Coaching"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes</label>
                <textarea
                  className="w-full rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
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
