'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfileSchema } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { normalizePakistanPhone } from '@/lib/form-validation';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { UserAvatar } from '@/components/layout/user-avatar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';
import { cn } from '@/lib/utils';

const MfaSettings = dynamic(
  () => import('@/components/auth/mfa-settings').then((m) => ({ default: m.MfaSettings })),
  { loading: () => <PageContentSkeleton /> },
);

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

function ContactRow({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  const className =
    'inline-flex max-w-full items-center gap-2 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:text-[var(--text-main-900)]';

  if (!href) {
    return (
      <span className={className} title={label}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} title={label}>
      {children}
    </a>
  );
}

export default function ProfilePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { errors, validate, clearField, fieldClassName, applyApiErrors } =
    useFormErrors(updateProfileSchema);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  const { data: sessions } = useQuery({
    queryKey: ['auth-sessions', page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; deviceInfo: string | null; lastActiveAt: string }>>(
        `/auth/sessions?page=${page}&limit=${limit}`,
        { token },
      ),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/auth/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSaveProfile = () => {
    const payload = {
      fullName: fullName.trim(),
      phone: phone.trim() ? normalizePakistanPhone(phone.trim()) : null,
    };
    if (!validate(payload)) return;
    saveMutation.mutate(payload);
  };

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/auth/sessions/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={User} title="My profile" description={user?.email} />

      <section className="overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={fullName || user?.email || 'User'} seed={user?.id} size="lg" className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-medium leading-7 tracking-[-0.015em] text-[var(--text-main-900)]">
              {fullName || 'Your profile'}
            </h1>
            <p className="mt-1 text-sm leading-5 text-[var(--text-sub-500,#525866)]">{user?.email}</p>
            <div className="mt-3 flex flex-row flex-wrap items-center gap-x-8 gap-y-3">
              <ContactRow href={phone ? `tel:${phone}` : undefined} label={phone || 'No phone'}>
                <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="whitespace-nowrap">{phone || 'Add phone number'}</span>
              </ContactRow>
              <ContactRow href={user?.email ? `mailto:${user.email}` : undefined} label={user?.email ?? ''}>
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="whitespace-nowrap">{user?.email}</span>
              </ContactRow>
            </div>
          </div>
        </div>
      </section>

      <ContentPanel title="Account">
        <div className="space-y-4 px-5 py-5">
          <div>
            <Input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearField('fullName');
              }}
              placeholder="Full name"
              className={fieldClassName('fullName', '')}
            />
            <FormFieldError message={errors.fullName} />
          </div>
          <div>
            <Input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearField('phone');
              }}
              placeholder="Phone"
              className={fieldClassName('phone', '')}
            />
            <FormFieldError message={errors.phone} />
          </div>
          <Button onClick={handleSaveProfile} disabled={saveMutation.isPending}>
            Save profile
          </Button>
        </div>
      </ContentPanel>

      <MfaSettings />

      <ContentPanel title="Recent sessions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Device</th>
                <th className={thClass}>Last active</th>
                <th className={cn(thClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {sessions?.data.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                    No sessions found
                  </td>
                </tr>
              )}
              {sessions?.data.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                  <td className={tdClass}>{s.deviceInfo ?? 'Unknown device'}</td>
                  <td className={tdClass}>{new Date(s.lastActiveAt).toLocaleString()}</td>
                  <td className={cn(tdClass, 'text-right')}>
                    <RowActionsMenu
                      items={[{ label: 'Revoke', onClick: () => revokeMutation.mutate(s.id) }]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions?.meta && sessions.meta.totalPages > 0 && (
          <PaginationBar
            page={page}
            totalPages={sessions.meta.totalPages}
            onPageChange={setPage}
            limit={limit}
            onLimitChange={handleLimitChange}
          />
        )}
      </ContentPanel>
    </div>
  );
}
