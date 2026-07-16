'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import type { UserDetailResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import {
  UserDetailSkeleton,
  UserDetailView,
} from '@/components/features/users/user-detail-view';
import { EditUserDialog } from '@/components/features/users/edit-user-dialog';
import { queryKeys } from '@/lib/query-keys';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canManage = can(PERMISSIONS.USERS_MANAGE);
  const [editOpen, setEditOpen] = useState(false);

  const { data: user, isLoading, error } = useQuery({
    queryKey: queryKeys.userDetail(id),
    queryFn: () => apiClient<UserDetailResponse>(`/users/${id}`, { token }),
    enabled: !!token && !!id,
  });

  if (isLoading) {
    return <UserDetailSkeleton />;
  }

  if (error || !user) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <PageHeader icon={UserCog} title="User not found" description="This user may have been removed." />
        <button
          type="button"
          onClick={() => router.push('/dashboard/users')}
          className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
        >
          Back to users
        </button>
      </div>
    );
  }

  return (
    <>
      <UserDetailView
        user={user}
        onEdit={canManage ? () => setEditOpen(true) : undefined}
      />
      <EditUserDialog userId={user.id} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
