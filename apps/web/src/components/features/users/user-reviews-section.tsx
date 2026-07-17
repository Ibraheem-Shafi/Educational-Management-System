'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

interface ReviewRow {
  id: string;
  periodLabel: string;
  reviewedAt: string;
  score: number | null;
  summary: string;
}

export function UserReviewsSection({
  userId,
  branchId,
}: {
  userId: string;
  branchId: string | null;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.HR_MANAGE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    periodLabel: '',
    reviewedAt: '',
    score: '',
    summary: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hr-reviews', userId],
    queryFn: () =>
      apiClient<{ data: ReviewRow[] }>(`/hr/reviews?userId=${userId}`, { token }),
    enabled: !!token && !!userId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!branchId) throw new Error('Branch is required');
      return apiClient('/hr/reviews', {
        method: 'POST',
        token,
        body: JSON.stringify({
          userId,
          branchId,
          periodLabel: form.periodLabel.trim(),
          reviewedAt: form.reviewedAt,
          score: form.score ? Number(form.score) : null,
          summary: form.summary.trim(),
        }),
      });
    },
    onSuccess: () => {
      toast.success('Review added');
      queryClient.invalidateQueries({ queryKey: ['hr-reviews', userId] });
      setDialogOpen(false);
      setForm({ periodLabel: '', reviewedAt: '', score: '', summary: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/hr/reviews/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Review removed');
      queryClient.invalidateQueries({ queryKey: ['hr-reviews', userId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviews = data?.data ?? [];

  if (!branchId) {
    return <p className="text-sm text-[var(--text-sub-500)]">Assign a branch to manage reviews.</p>;
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-1.5 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
          >
            <Plus className="h-4 w-4" />
            Add review
          </button>
        </div>
      )}
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Period</th>
              <th className={dataTableThClass}>Reviewed</th>
              <th className={dataTableThClass}>Score</th>
              <th className={dataTableThClass}>Summary</th>
              {canManage && <th className={dataTableThClass}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 5 : 4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                  Loading…
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 5 : 4} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                  No performance reviews
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id}>
                  <td className={dataTableTdClass}>{r.periodLabel}</td>
                  <td className={dataTableTdClass}>{r.reviewedAt}</td>
                  <td className={dataTableTdClass}>{r.score ?? '—'}</td>
                  <td className={cn(dataTableTdClass, 'max-w-xs truncate')}>{r.summary}</td>
                  {canManage && (
                    <td className={dataTableTdClass}>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="text-sm text-red-600 hover:underline"
                        disabled={deleteMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md gap-0 p-0" aria-describedby={undefined}>
          <div className="border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            <DialogTitle>Add performance review</DialogTitle>
            <DialogDescription className="mt-1">Record a review period for this staff member</DialogDescription>
          </div>
          <form
            className="space-y-4 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.periodLabel.trim() || !form.reviewedAt || !form.summary.trim()) {
                toast.error('Period, review date, and summary are required');
                return;
              }
              createMutation.mutate();
            }}
          >
            <div>
              <FormFieldLabel required>Period label</FormFieldLabel>
              <input type="text" value={form.periodLabel} onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))} placeholder="Q1 2026" className={modalFieldClassName} required />
            </div>
            <div>
              <FormFieldLabel required>Review date</FormFieldLabel>
              <input type="date" value={form.reviewedAt} onChange={(e) => setForm((f) => ({ ...f, reviewedAt: e.target.value }))} className={modalFieldClassName} required />
            </div>
            <div>
              <FormFieldLabel>Score (0–100)</FormFieldLabel>
              <input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} className={modalFieldClassName} />
            </div>
            <div>
              <FormFieldLabel required>Summary</FormFieldLabel>
              <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} rows={4} className={cn(modalFieldClassName, 'min-h-[96px] resize-y')} required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setDialogOpen(false)} className="flex-1 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] py-2 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="flex-1 rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] py-2 text-sm font-medium text-white disabled:opacity-50">
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
