'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency, PERMISSIONS } from '@eims/shared';
import { ContentPanel } from '@/components/layout/content-panel';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

interface FeeInvoice {
  id: string;
  feeType?: { name: string };
  netAmount: number;
  status?: { label: string; code?: string };
  paidAt?: string | null;
}

const PAYABLE_STATUSES = new Set(['pending', 'partial', 'overdue']);

export function PortalFeesSection({
  outstanding,
  invoices,
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
}: {
  outstanding: number;
  invoices: FeeInvoice[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { can } = usePermissions();
  const canCheckout = can(PERMISSIONS.PAYMENTS_CHECKOUT);

  const checkoutMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient<{ checkoutUrl: string }>('/payments/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ invoiceId }),
      }),
    onSuccess: (data) => {
      if (data.checkoutUrl.startsWith('http')) {
        window.location.href = data.checkoutUrl;
      } else {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <MainStatsSection
        stats={[
          { label: 'Outstanding', value: formatCurrency(outstanding) },
          { label: 'Invoices on page', value: String(invoices.length) },
        ]}
      />

      <ContentPanel title="Invoices">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[560px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Fee type</th>
                <th className={dataTableThClass}>Amount</th>
                <th className={dataTableThClass}>Status</th>
                {canCheckout && <th className={dataTableThClass} />}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={canCheckout ? 4 : 3}
                    className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]"
                  >
                    No invoices
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const canPay =
                    canCheckout &&
                    inv.id &&
                    (!inv.status?.code || PAYABLE_STATUSES.has(inv.status.code));

                  return (
                    <tr key={inv.id}>
                      <td className={dataTableTdClass}>{inv.feeType?.name ?? 'Fee'}</td>
                      <td className={dataTableTdClass}>{formatCurrency(inv.netAmount)}</td>
                      <td className={dataTableTdClass}>
                        {inv.status ? (
                          <StatusBadge label={inv.status.label} code={inv.status.code} />
                        ) : (
                          '—'
                        )}
                      </td>
                      {canCheckout && (
                        <td className={cn(dataTableTdClass, 'text-right')}>
                          {canPay ? (
                            <button
                              type="button"
                              disabled={checkoutMutation.isPending}
                              onClick={() => checkoutMutation.mutate(inv.id)}
                              className="rounded-lg bg-[var(--primary-base,#2563EB)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Pay online
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {page && totalPages && onPageChange && (
          <div className="border-t border-stroke-soft-200 px-5 py-3">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              limit={limit ?? 8}
              onLimitChange={onLimitChange ?? (() => {})}
            />
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
