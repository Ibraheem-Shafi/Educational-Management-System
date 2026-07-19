'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { updateProfileSchema } from '@eims/shared';
import { toast } from 'sonner';
import type { PortalParentProfileResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { UserAvatar } from '@/components/layout/user-avatar';
import { Button } from '@/components/ui/button';
import { FormFieldError } from '@/components/forms/form-field-error';
import { useFormErrors } from '@/hooks/use-form-errors';

export default function ParentProfilePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const { errors, clearField, validate, applyApiErrors, fieldClassName } =
    useFormErrors(updateProfileSchema);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.portalParentProfile,
    queryFn: () => apiClient<PortalParentProfileResponse>('/portal/parent/profile', { token }),
    enabled: !!token,
  });

  const save = useMutation({
    mutationFn: (payload: { phone: string | null }) =>
      apiClient('/auth/me', { method: 'PATCH', body: payload, token }),
    onSuccess: async () => {
      toast.success('Profile updated');
      await queryClient.invalidateQueries({ queryKey: queryKeys.portalParentProfile });
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error('Unable to update profile');
    },
  });

  if (isLoading && !data) return <PortalPageSkeleton />;

  const profile = data?.user ?? user;
  const phoneValue = phone || data?.user.phone || '';

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={UserRound} title="Profile" description="Your account and linked children" />

      <ContentPanel title="Account">
        <div className="flex items-start gap-4 px-5 py-4">
          <UserAvatar name={profile?.fullName} size="lg" />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="font-medium text-text-main-900">{profile?.fullName}</p>
            <p className="text-[var(--text-sub-500)]">{profile?.email}</p>
            <label className="mt-3 block">
              <span className="text-xs text-[var(--text-sub-500)]">Phone</span>
              <input
                className={fieldClassName(
                  'phone',
                  'mt-1 w-full max-w-xs rounded-lg border border-stroke-soft-200 px-3 py-2',
                )}
                value={phoneValue}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearField('phone');
                }}
              />
              <FormFieldError message={errors.phone} />
            </label>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => {
                const payload = { phone: phoneValue.trim() || null };
                if (!validate(payload)) return;
                save.mutate(payload);
              }}
              disabled={save.isPending}
            >
              Save phone
            </Button>
          </div>
        </div>
      </ContentPanel>

      {data?.parent && (
        <ContentPanel title="Parent record">
          <dl className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-sub-500)]">Parent phone</dt>
              <dd className="font-medium">{data.parent.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub-500)]">Address</dt>
              <dd className="font-medium">{data.parent.address ?? '—'}</dd>
            </div>
          </dl>
        </ContentPanel>
      )}

      <ContentPanel title={`Linked children (${data?.children.length ?? 0})`}>
        {data?.children.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No linked children</p>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {data?.children.map((child) => (
              <li key={child.id} className="px-5 py-3 text-sm">
                <p className="font-medium text-text-main-900">{child.fullName}</p>
                <p className="text-[var(--text-sub-500)]">{child.relationshipCode}</p>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>
    </div>
  );
}
