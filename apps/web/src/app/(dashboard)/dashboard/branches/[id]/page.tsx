'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BranchDetailResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import {
  BranchDetailSkeleton,
  BranchDetailView,
} from '@/components/features/branches/branch-detail-view';
import { EditBranchDialog } from '@/components/features/branches/edit-branch-dialog';
import {
  DeactivateBranchDialog,
  type DeactivateBranchTarget,
} from '@/components/features/branches/deactivate-branch-dialog';
import { queryKeys } from '@/lib/query-keys';

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateBranchTarget | null>(null);

  const { data: branch, isLoading, error } = useQuery({
    queryKey: queryKeys.branchDetail(id),
    queryFn: () => apiClient<BranchDetailResponse>(`/branches/${id}`, { token }),
    enabled: !!token && !!id,
  });

  const invalidateBranchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    queryClient.invalidateQueries({ queryKey: queryKeys.branchesStats });
    queryClient.invalidateQueries({ queryKey: queryKeys.branchDetail(id) });
  };

  const deactivateMutation = useMutation({
    mutationFn: (branchId: string) =>
      apiClient(`/branches/${branchId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Branch deactivated');
      setDeactivateTarget(null);
      invalidateBranchQueries();
      router.push('/dashboard/branches');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <BranchDetailSkeleton />;
  }

  if (error || !branch) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <PageHeader icon={Building2} title="Branch not found" description="This branch may have been removed." />
        <button
          type="button"
          onClick={() => router.push('/dashboard/branches')}
          className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
        >
          Back to branches
        </button>
      </div>
    );
  }

  return (
    <>
      <BranchDetailView branch={branch} onEdit={() => setEditOpen(true)} />

      <EditBranchDialog branchId={branch.id} open={editOpen} onOpenChange={setEditOpen} />

      <DeactivateBranchDialog
        branch={deactivateTarget}
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        onConfirm={() => {
          if (deactivateTarget) deactivateMutation.mutate(deactivateTarget.id);
        }}
        isPending={deactivateMutation.isPending}
      />
    </>
  );
}
