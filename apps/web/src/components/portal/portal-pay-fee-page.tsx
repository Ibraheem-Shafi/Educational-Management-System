'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { cn } from '@/lib/utils';

interface PaymentDetails {
  id: string;
  amount: number;
  provider: string;
  status: string;
  paidAt: string | null;
  invoice: {
    id: string;
    netAmount: number;
    feeType?: { name: string } | null;
    student?: { fullName: string };
  };
}

export function PortalPayFeePage({ returnPath }: { returnPath: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId;

  const statusParam = searchParams.get('status');

  const { data: payment, isLoading, error, refetch } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => apiClient<PaymentDetails>(`/payments/${paymentId}`, { token }),
    enabled: !!token && !!paymentId,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiClient('/payments/webhooks/mock', {
        method: 'POST',
        token,
        body: JSON.stringify({ paymentId }),
      }),
    onSuccess: () => {
      toast.success('Payment confirmed');
      refetch();
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentFees() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalParentFees() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentStats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.portalParentStats });
      void queryClient.invalidateQueries({ queryKey: ['payment', paymentId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      void queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--text-sub-500)]">Loading payment…</p>;
  }

  if (error || !payment) {
    return (
      <ContentPanel title="Payment">
        <p className="text-sm text-red-600">Unable to load payment details.</p>
      </ContentPanel>
    );
  }

  const isPaid = payment.status === 'succeeded';
  const isMock = payment.provider === 'mock';
  const cancelled = statusParam === 'cancelled';

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <ContentPanel title="Fee payment">
        <div className="space-y-4 px-1 py-2">
          {isPaid ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-5" />
              <span className="font-medium">Payment successful</span>
            </div>
          ) : cancelled ? (
            <p className="text-sm text-amber-700">Payment was cancelled.</p>
          ) : (
            <p className="text-sm text-[var(--text-sub-500)]">Complete your fee payment below.</p>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-[var(--text-sub-500)]">Student</dt>
            <dd>{payment.invoice.student?.fullName ?? '—'}</dd>
            <dt className="text-[var(--text-sub-500)]">Fee type</dt>
            <dd>{payment.invoice.feeType?.name ?? 'Fee'}</dd>
            <dt className="text-[var(--text-sub-500)]">Amount</dt>
            <dd className="font-medium">{formatCurrency(payment.amount)}</dd>
            <dt className="text-[var(--text-sub-500)]">Status</dt>
            <dd className="capitalize">{payment.status}</dd>
          </dl>

          {!isPaid && isMock && !cancelled && (
            <button
              type="button"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
              className={cn(
                'w-full rounded-lg bg-[var(--primary-base,#2563EB)] px-4 py-2.5 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {confirmMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Confirming…
                </span>
              ) : (
                'Confirm payment (mock)'
              )}
            </button>
          )}

          {!isPaid && !isMock && (
            <p className="text-sm text-[var(--text-sub-500)]">
              Complete payment on the provider checkout page. This page will update when payment is
              confirmed.
            </p>
          )}

          <button
            type="button"
            onClick={() => router.push(returnPath)}
            className="w-full rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm"
          >
            Back to fees
          </button>
        </div>
      </ContentPanel>
    </div>
  );
}
