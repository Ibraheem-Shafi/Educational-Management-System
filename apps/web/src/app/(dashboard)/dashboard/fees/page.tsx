'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type { FeesRevenueTrendResponse, FeesStatsResponse, PaginatedResponse } from '@eims/types';
import { currencyStat, formatCurrency, formatCurrencyCompact, PERMISSIONS } from '@eims/shared';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Tabs } from '@/components/ui/tabs';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import { CreateInvoiceDialog } from '@/components/features/fees/create-invoice-dialog';
import { GenerateInvoicesDialog } from '@/components/features/fees/generate-invoices-dialog';
import { FeeTypesPanel, type FeeTypeRow } from '@/components/features/fees/fee-types-panel';
import { FeeStructuresPanel } from '@/components/features/fees/fee-structures-panel';
import {
  RecordPaymentDialog,
  type PayInvoiceTarget,
  type PaymentDialogMode,
} from '@/components/features/fees/record-payment-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';

const filterDateClassName =
  'h-10 rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 text-sm text-[var(--text-main-900,#0A0D14)]';

interface Invoice {
  id: string;
  student?: { fullName: string };
  feeType?: { name: string };
  netAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  dueDate: string | null;
  status?: { label: string; code: string };
  paidAt: string | null;
  latestPaymentId?: string | null;
}

interface LookupStatus {
  id: string;
  code: string;
  label: string;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function toPayTarget(invoice: {
  id: string;
  netAmount: number;
  remainingAmount?: number;
  student?: { fullName: string };
}): PayInvoiceTarget {
  return {
    id: invoice.id,
    netAmount: invoice.netAmount,
    remainingAmount: invoice.remainingAmount ?? invoice.netAmount,
    student: invoice.student,
  };
}

export default function FeesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canCollect = can(PERMISSIONS.FEES_COLLECT);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<PayInvoiceTarget | null>(null);
  const [payMode, setPayMode] = useState<PaymentDialogMode>('partial');
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(8);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [defaulterPage, setDefaulterPage] = useState(1);
  const [defaulterLimit, setDefaulterLimit] = useState(8);
  const [defaulterSearch, setDefaulterSearch] = useState('');
  const [defaulterDueFrom, setDefaulterDueFrom] = useState('');
  const [defaulterDueTo, setDefaulterDueTo] = useState('');
  const [completedPage, setCompletedPage] = useState(1);
  const [completedLimit, setCompletedLimit] = useState(8);
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedFeeTypeId, setCompletedFeeTypeId] = useState('');
  const [tab, setTab] = useState<
    'invoices' | 'completed' | 'defaulters' | 'fee-types' | 'structures'
  >('invoices');

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const handleInvoiceSearchChange = useCallback((value: string) => {
    setInvoiceSearch(value);
    setInvoicePage(1);
  }, []);

  const handleCompletedSearchChange = useCallback((value: string) => {
    setCompletedSearch(value);
    setCompletedPage(1);
  }, []);

  const handleDefaulterSearchChange = useCallback((value: string) => {
    setDefaulterSearch(value);
    setDefaulterPage(1);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.feesStats, scopeKey],
    queryFn: () => apiClient<FeesStatsResponse>(withBranchScope('/fees/stats', effectiveScope), { token }),
    enabled: !!token,
  });

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: [...queryKeys.feesRevenueTrend, scopeKey],
    queryFn: () =>
      apiClient<FeesRevenueTrendResponse>(withBranchScope('/fees/revenue-trend', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const { data: feeStatuses } = useQuery({
    queryKey: queryKeys.lookups('fee_status'),
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/fee_status', { token }),
    enabled: !!token && (tab === 'invoices' || tab === 'completed'),
  });

  const paidStatusId = feeStatuses?.statuses.find((s) => s.code === 'paid')?.id ?? '';

  const { data: feeTypes } = useQuery({
    queryKey: queryKeys.feeTypes(),
    queryFn: () => apiClient<{ data: FeeTypeRow[] }>('/fee-types', { token }),
    enabled: !!token && (tab === 'invoices' || tab === 'completed'),
  });

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: [
      'fee-invoices',
      scopeKey,
      invoicePage,
      invoiceLimit,
      invoiceSearch,
      statusId,
      feeTypeId,
      dueFrom,
      dueTo,
    ],
    queryFn: () =>
      apiClient<PaginatedResponse<Invoice>>(
        withBranchScope('/fee-invoices', effectiveScope, {
          page: invoicePage,
          limit: invoiceLimit,
          search: invoiceSearch || undefined,
          statusId: statusId || undefined,
          feeTypeId: feeTypeId || undefined,
          dueFrom: dueFrom || undefined,
          dueTo: dueTo || undefined,
        }),
        { token },
      ),
    enabled: !!token && tab === 'invoices',
  });

  const {
    data: completedInvoices,
    isLoading: completedLoading,
    error: completedError,
  } = useQuery({
    queryKey: [
      'fee-invoices-completed',
      scopeKey,
      completedPage,
      completedLimit,
      completedSearch,
      completedFeeTypeId,
      paidStatusId,
    ],
    queryFn: () =>
      apiClient<PaginatedResponse<Invoice>>(
        withBranchScope('/fee-invoices', effectiveScope, {
          page: completedPage,
          limit: completedLimit,
          search: completedSearch || undefined,
          statusId: paidStatusId,
          feeTypeId: completedFeeTypeId || undefined,
        }),
        { token },
      ),
    enabled: !!token && tab === 'completed' && !!paidStatusId,
  });

  const { data: defaulters, isLoading: defaultersLoading, error: defaultersError } = useQuery({
    queryKey: [
      ...queryKeys.reportsFeeDefaulters({
        scopeKey,
        page: defaulterPage,
        limit: defaulterLimit,
        search: defaulterSearch,
        dueFrom: defaulterDueFrom,
        dueTo: defaulterDueTo,
      }),
    ],
    queryFn: () =>
      apiClient<{
        data: Array<{
          id: string;
          student: { fullName: string };
          netAmount: number;
          remainingAmount?: number;
          dueDate: string | null;
        }>;
        total: number;
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>(
        withBranchScope('/reports/fee-defaulters', effectiveScope, {
          page: defaulterPage,
          limit: defaulterLimit,
          search: defaulterSearch || undefined,
          dueFrom: defaulterDueFrom || undefined,
          dueTo: defaulterDueTo || undefined,
        }),
        { token },
      ),
    enabled: !!token && tab === 'defaulters',
  });

  const openRecordPayment = (invoice: PayInvoiceTarget, mode: PaymentDialogMode = 'partial') => {
    setPayMode(mode);
    setPayInvoice(invoice);
  };

  const handleLimitChange = useCallback((next: number) => {
    setInvoiceLimit(next);
    setInvoicePage(1);
  }, []);

  const handleCompletedLimitChange = useCallback((next: number) => {
    setCompletedLimit(next);
    setCompletedPage(1);
  }, []);

  const handleDefaulterLimitChange = useCallback((next: number) => {
    setDefaulterLimit(next);
    setDefaulterPage(1);
  }, []);

  const hasInvoiceFilters = Boolean(invoiceSearch || statusId || feeTypeId || dueFrom || dueTo);
  const hasCompletedFilters = Boolean(completedSearch || completedFeeTypeId);
  const hasDefaulterFilters = Boolean(defaulterSearch || defaulterDueFrom || defaulterDueTo);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Receipt}
        title="Fees"
        description="Invoices and payment collection"
        actions={
          canCollect && tab === 'invoices' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setGenerateOpen(true)}
                className={pageHeaderActionClassName}
              >
                Generate invoices
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className={pageHeaderActionClassName}
              >
                <PageHeaderActionIcon />
                New invoice
              </button>
            </div>
          ) : undefined
        }
      />

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={singleBranchId ?? ''}
      />

      <GenerateInvoicesDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        branchId={singleBranchId ?? ''}
      />

      <RecordPaymentDialog
        open={!!payInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setPayInvoice(null);
            setPayMode('partial');
          }
        }}
        invoice={payInvoice}
        mode={payMode}
        onPaidInFull={() => {
          setCompletedPage(1);
          setTab('completed');
        }}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Outstanding',
            ...currencyStat(stats?.outstandingAmount.total ?? 0),
            changePercent: stats?.outstandingAmount.changePercent,
          },
          {
            label: 'Collected (30d)',
            ...currencyStat(stats?.collectedLast30Days.total ?? 0),
            changePercent: stats?.collectedLast30Days.changePercent,
          },
          {
            label: 'Overdue invoices',
            value: formatCount(stats?.overdueCount.total ?? 0),
            changePercent: stats?.overdueCount.changePercent,
          },
          {
            label: 'Invoices issued',
            value: formatCount(stats?.invoicesIssued.total ?? 0),
            changePercent: stats?.invoicesIssued.changePercent,
          },
        ]}
      />

      <TrendAreaChart
        title="Revenue trend"
        subtitle="Last 6 months"
        data={trend?.points ?? []}
        changePercent={trend?.changePercent}
        isLoading={trendLoading}
        valueFormatter={(v) => formatCurrencyCompact(v)}
        gradientId="feesRevenueGradient"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          aria-label="Fees sections"
          tabs={[
            { id: 'invoices', label: 'Invoices' },
            { id: 'completed', label: 'Completed' },
            { id: 'defaulters', label: 'Fee Defaulter' },
            { id: 'fee-types', label: 'Fee types' },
            { id: 'structures', label: 'Structures' },
          ]}
          value={tab}
          onValueChange={(id) =>
            setTab(id as 'invoices' | 'completed' | 'defaulters' | 'fee-types' | 'structures')
          }
        />
        <PageBranchScopeControl />
      </div>

      {tab === 'invoices' && (
        <div className="space-y-4">
          <FilterBar className="items-end">
            <SearchInput
              value={invoiceSearch}
              onValueChange={handleInvoiceSearchChange}
              placeholder="Search student or invoice #"
            />
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All statuses"
              value={statusId}
              onValueChange={(next) => {
                setStatusId(next);
                setInvoicePage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                ...(feeStatuses?.statuses.map((s) => ({ value: s.id, label: s.label })) ?? []),
              ]}
            />
            <SelectDropdown
              aria-label="Filter by fee type"
              placeholder="All fee types"
              value={feeTypeId}
              onValueChange={(next) => {
                setFeeTypeId(next);
                setInvoicePage(1);
              }}
              options={[
                { value: '', label: 'All fee types' },
                ...(feeTypes?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
              ]}
            />
            <DateField
              label="Due from"
              aria-label="Due from"
              className={filterDateClassName}
              value={dueFrom}
              confirmPast={false}
              onValueChange={(next) => {
                setDueFrom(next);
                setInvoicePage(1);
              }}
            />
            <DateField
              label="Due to"
              aria-label="Due to"
              className={filterDateClassName}
              value={dueTo}
              confirmPast={false}
              min={dueFrom || undefined}
              onValueChange={(next) => {
                setDueTo(next);
                setInvoicePage(1);
              }}
            />
            {hasInvoiceFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setInvoiceSearch('');
                  setStatusId('');
                  setFeeTypeId('');
                  setDueFrom('');
                  setDueTo('');
                  setInvoicePage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Fee type</th>
                    <th className={dataTableThClass}>Amount</th>
                    <th className={dataTableThClass}>Remaining</th>
                    <th className={dataTableThClass}>Due date</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={cn(dataTableThClass, 'w-12')} />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading && <DataTableSkeletonRows columns={7} rows={invoiceLimit} />}

                  {error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-600">
                        Failed to load invoices
                      </td>
                    </tr>
                  )}

                  {!isLoading && !error && invoices?.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                      >
                        No invoices found
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !error &&
                    invoices?.data.map((inv) => (
                      <tr key={inv.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                        <td className={dataTableTdClass}>{inv.student?.fullName ?? '—'}</td>
                        <td className={dataTableTdClass}>{inv.feeType?.name ?? '—'}</td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {formatCurrency(inv.netAmount)}
                        </td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {formatCurrency(inv.remainingAmount ?? inv.netAmount)}
                        </td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className={dataTableTdClass}>
                          {inv.status ? (
                            <StatusBadge label={inv.status.label} code={inv.status.code} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={cn(dataTableTdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Print voucher',
                                onClick: () => window.open(`/print/fee-invoices/${inv.id}`, '_blank'),
                              },
                              ...(inv.latestPaymentId
                                ? [
                                    {
                                      label: 'Print receipt',
                                      onClick: () =>
                                        window.open(
                                          `/print/fee-receipts/${inv.latestPaymentId}`,
                                          '_blank',
                                        ),
                                    },
                                  ]
                                : []),
                              ...(canCollect && !inv.paidAt
                                ? [
                                    {
                                      label: 'Record payment',
                                      onClick: () => openRecordPayment(toPayTarget(inv), 'partial'),
                                    },
                                    {
                                      label: 'Pay in full',
                                      onClick: () => openRecordPayment(toPayTarget(inv), 'full'),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {invoices && (
              <PaginationBar
                page={invoicePage}
                totalPages={invoices.meta.totalPages}
                limit={invoiceLimit}
                onPageChange={setInvoicePage}
                onLimitChange={handleLimitChange}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'completed' && (
        <div className="space-y-4">
          <FilterBar className="items-end">
            <SearchInput
              value={completedSearch}
              onValueChange={handleCompletedSearchChange}
              placeholder="Search student or invoice #"
            />
            <SelectDropdown
              aria-label="Filter by fee type"
              placeholder="All fee types"
              value={completedFeeTypeId}
              onValueChange={(next) => {
                setCompletedFeeTypeId(next);
                setCompletedPage(1);
              }}
              options={[
                { value: '', label: 'All fee types' },
                ...(feeTypes?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
              ]}
            />
            {hasCompletedFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCompletedSearch('');
                  setCompletedFeeTypeId('');
                  setCompletedPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Fee type</th>
                    <th className={dataTableThClass}>Amount</th>
                    <th className={dataTableThClass}>Paid date</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={cn(dataTableThClass, 'w-12')} />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {(completedLoading || !paidStatusId) && (
                    <DataTableSkeletonRows columns={6} rows={completedLimit} />
                  )}

                  {completedError && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">
                        Failed to load completed invoices
                      </td>
                    </tr>
                  )}

                  {!completedLoading &&
                    !completedError &&
                    paidStatusId &&
                    completedInvoices?.data.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                        >
                          No completed fee payments yet
                        </td>
                      </tr>
                    )}

                  {!completedLoading &&
                    !completedError &&
                    completedInvoices?.data.map((inv) => (
                      <tr key={inv.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                        <td className={dataTableTdClass}>{inv.student?.fullName ?? '—'}</td>
                        <td className={dataTableTdClass}>{inv.feeType?.name ?? '—'}</td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {formatCurrency(inv.netAmount)}
                        </td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                        </td>
                        <td className={dataTableTdClass}>
                          {inv.status ? (
                            <StatusBadge label={inv.status.label} code={inv.status.code} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={cn(dataTableTdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Print voucher',
                                onClick: () =>
                                  window.open(`/print/fee-invoices/${inv.id}`, '_blank'),
                              },
                              ...(inv.latestPaymentId
                                ? [
                                    {
                                      label: 'Print receipt',
                                      onClick: () =>
                                        window.open(
                                          `/print/fee-receipts/${inv.latestPaymentId}`,
                                          '_blank',
                                        ),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {completedInvoices && (
              <PaginationBar
                page={completedPage}
                totalPages={completedInvoices.meta.totalPages}
                limit={completedLimit}
                onPageChange={setCompletedPage}
                onLimitChange={handleCompletedLimitChange}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'fee-types' && <FeeTypesPanel canManage={canCollect} />}

      {tab === 'structures' && (
        <FeeStructuresPanel
          canManage={canCollect}
          branchId={singleBranchId ?? ''}
          scopeKey={scopeKey}
          effectiveScope={effectiveScope}
        />
      )}

      {tab === 'defaulters' && (
        <div className="space-y-4">
          <FilterBar className="items-end">
            <SearchInput
              value={defaulterSearch}
              onValueChange={handleDefaulterSearchChange}
              placeholder="Search student"
            />
            <DateField
              label="Due from"
              aria-label="Due from"
              className={filterDateClassName}
              value={defaulterDueFrom}
              confirmPast={false}
              onValueChange={(next) => {
                setDefaulterDueFrom(next);
                setDefaulterPage(1);
              }}
            />
            <DateField
              label="Due to"
              aria-label="Due to"
              className={filterDateClassName}
              value={defaulterDueTo}
              confirmPast={false}
              min={defaulterDueFrom || undefined}
              onValueChange={(next) => {
                setDefaulterDueTo(next);
                setDefaulterPage(1);
              }}
            />
            {hasDefaulterFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDefaulterSearch('');
                  setDefaulterDueFrom('');
                  setDefaulterDueTo('');
                  setDefaulterPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[640px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Due date</th>
                    <th className={dataTableThClass}>Amount</th>
                    <th className={cn(dataTableThClass, 'w-12')} />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {defaultersLoading && <DataTableSkeletonRows columns={4} rows={defaulterLimit} />}

                  {defaultersError && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">
                        Failed to load fee defaulters
                      </td>
                    </tr>
                  )}

                  {!defaultersLoading && !defaultersError && defaulters?.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                      >
                        No overdue invoices
                      </td>
                    </tr>
                  )}
                  {!defaultersLoading &&
                    !defaultersError &&
                    defaulters?.data.map((inv) => (
                      <tr key={inv.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                        <td className={dataTableTdClass}>{inv.student.fullName}</td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                          {formatCurrency(inv.remainingAmount ?? inv.netAmount)}
                        </td>
                        <td className={cn(dataTableTdClass, 'text-right')}>
                          {canCollect ? (
                            <RowActionsMenu
                              items={[
                                {
                                  label: 'Record payment',
                                  onClick: () => openRecordPayment(toPayTarget(inv), 'partial'),
                                },
                                {
                                  label: 'Pay in full',
                                  onClick: () => openRecordPayment(toPayTarget(inv), 'full'),
                                },
                              ]}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {defaulters?.meta && (
              <PaginationBar
                page={defaulterPage}
                totalPages={defaulters.meta.totalPages}
                limit={defaulterLimit}
                onPageChange={setDefaulterPage}
                onLimitChange={handleDefaulterLimitChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
