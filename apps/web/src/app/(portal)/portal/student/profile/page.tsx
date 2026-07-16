'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { PortalStudentProfileResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { UserAvatar } from '@/components/layout/user-avatar';
import { Button } from '@/components/ui/button';

export default function StudentProfilePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.portalStudentProfile,
    queryFn: () => apiClient<PortalStudentProfileResponse>('/portal/student/profile', { token }),
    enabled: !!token,
  });

  const save = useMutation({
    mutationFn: () => apiClient('/auth/me', { method: 'PATCH', body: { phone: phone || null }, token }),
    onSuccess: async () => {
      toast.success('Profile updated');
      await queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentProfile });
    },
    onError: () => toast.error('Unable to update profile'),
  });

  if (isLoading && !data) return <PortalPageSkeleton />;

  const profile = data?.user ?? user;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={UserRound} title="Profile" description="Your account and student details" />

      <ContentPanel title="Account">
        <div className="flex items-start gap-4 px-5 py-4">
          <UserAvatar name={profile?.fullName} size="lg" />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="font-medium text-text-main-900">{profile?.fullName}</p>
            <p className="text-[var(--text-sub-500)]">{profile?.email}</p>
            <label className="mt-3 block">
              <span className="text-xs text-[var(--text-sub-500)]">Phone</span>
              <input
                className="mt-1 w-full max-w-xs rounded-lg border border-stroke-soft-200 px-3 py-2"
                defaultValue={data?.user.phone ?? ''}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <Button className="mt-3" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save phone
            </Button>
          </div>
        </div>
      </ContentPanel>

      {data?.student && (
        <ContentPanel title="Student record">
          <dl className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-sub-500)]">Program</dt>
              <dd className="font-medium">{data.student.program?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub-500)]">Batch</dt>
              <dd className="font-medium">{data.student.batch?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub-500)]">Student phone</dt>
              <dd className="font-medium">{data.student.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-sub-500)]">Address</dt>
              <dd className="font-medium">{data.student.address ?? '—'}</dd>
            </div>
          </dl>
        </ContentPanel>
      )}
    </div>
  );
}
