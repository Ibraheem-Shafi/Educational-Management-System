'use client';

import { Fragment, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Receipt } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type {
  FeesRevenueTrendResponse,
  FeesStatsResponse,
  FeeDefaultersSummaryResponse,
  PaginatedResponse,
} from '@eims/types';
import {
  currencyStat,
  formatCurrency,
  formatCurrencyCompact,
  PERMISSIONS,
  type BranchScope,
} from '@eims/shared';
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
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { CreateInvoiceDialog } from '@/components/features/fees/create-invoice-dialog';
import { EditInvoiceDialog } from '@/components/features/fees/edit-invoice-dialog';
import { GenerateInvoicesDialog } from '@/components/features/fees/generate-invoices-dialog';
import { FeeTypesPanel, type FeeTypeRow } from '@/components/features/fees/fee-types-panel';
import { FeeStructuresPanel } from '@/components/features/fees/fee-structures-panel';
import { FeeChallansPanel } from '@/components/features/fees/fee-challans-panel';
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
  studentId?: string;
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

interface StudentInvoiceGroup {
  student: { id: string; fullName: string; admissionNumber?: string | null };
  totals: { invoiceCount: number; openBalance: number };
  preview: Invoice[];
}

interface LookupStatus {
  id: string;
  code: string;
  label: string;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function sharePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
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

function invoiceRowActions(
  inv: Invoice,
  canCollect: boolean,
  openRecordPayment: (invoice: PayInvoiceTarget, mode?: PaymentDialogMode) => void,
  openEditInvoice?: (invoiceId: string) => void,
) {
  return [
    {
      label: 'Print voucher',
      onClick: () => window.open(`/print/fee-invoices/${inv.id}`, '_blank'),
    },
    ...(inv.latestPaymentId
      ? [
          {
            label: 'Print receipt',
            onClick: () => window.open(`/print/fee-receipts/${inv.latestPaymentId}`, '_blank'),
          },
        ]
      : []),
    ...(canCollect && openEditInvoice
      ? [
          {
            label: 'Edit',
            onClick: () => openEditInvoice(inv.id),
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
  ];
}

function InvoiceTableRow({
  inv,
  canCollect,
  openRecordPayment,
  openEditInvoice,
  nested,
}: {
  inv: Invoice;
  canCollect: boolean;
  openRecordPayment: (invoice: PayInvoiceTarget, mode?: PaymentDialogMode) => void;
  openEditInvoice?: (invoiceId: string) => void;
  nested?: boolean;
}) {
  return (
    <tr className={cn('transition-colors', dataTableRowHoverClass, nested && 'bg-[var(--bg-weak-50,#F8F9FB)]')}>
      <td className={cn(dataTableTdClass, nested && 'pl-10 text-[var(--base-muted-foreground,#71717A)]')}>
        {nested ? '' : (inv.student?.fullName ?? '—')}
      </td>
      <td className={dataTableTdClass}>{inv.feeType?.name ?? '—'}</td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>{formatCurrency(inv.netAmount)}</td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
        {formatCurrency(inv.remainingAmount ?? inv.netAmount)}
      </td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
      </td>
      <td className={dataTableTdClass}>
        {inv.status ? <StatusBadge label={inv.status.label} code={inv.status.code} /> : '—'}
      </td>
      <td className={cn(dataTableTdClass, 'text-right')}>
        <RowActionsMenu
          items={invoiceRowActions(inv, canCollect, openRecordPayment, openEditInvoice)}
        />
      </td>
    </tr>
  );
}

function StudentInvoiceExpandRows({
  studentId,
  studentName,
  previewIds,
  filters,
  canCollect,
  openRecordPayment,
  openEditInvoice,
  token,
}: {
  studentId: string;
  studentName: string;
  previewIds: Set<string>;
  filters: {
    scope: BranchScope;
    statusId: string;
    feeTypeId: string;
    dueFrom: string;
    dueTo: string;
    search: string;
  };
  canCollect: boolean;
  openRecordPayment: (invoice: PayInvoiceTarget, mode?: PaymentDialogMode) => void;
  openEditInvoice?: (invoiceId: string) => void;
  token: string | undefined;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'fee-invoices-student',
      studentId,
      filters.statusId,
      filters.feeTypeId,
      filters.dueFrom,
      filters.dueTo,
      filters.search,
    ],
    queryFn: () =>
      apiClient<PaginatedResponse<Invoice>>(
        withBranchScope('/fee-invoices', filters.scope, {
          page: 1,
          limit: 100,
          studentId,
          search: filters.search || undefined,
          statusId: filters.statusId || undefined,
          feeTypeId: filters.feeTypeId || undefined,
          dueFrom: filters.dueFrom || undefined,
          dueTo: filters.dueTo || undefined,
        }),
        { token },
      ),
    enabled: !!token,
  });

  const rest = (data?.data ?? []).filter((inv) => !previewIds.has(inv.id));

  if (isLoading) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 pl-10 text-sm text-[var(--base-muted-foreground,#71717A)]">
          Loading more invoices for {studentName}…
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 pl-10 text-sm text-red-600">
          Failed to load remaining invoices
        </td>
      </tr>
    );
  }

  if (rest.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 pl-10 text-sm text-[var(--base-muted-foreground,#71717A)]">
          No additional invoices
        </td>
      </tr>
    );
  }

  return (
    <>
      {rest.map((inv) => (
        <InvoiceTableRow
          key={inv.id}
          inv={{ ...inv, student: inv.student ?? { fullName: studentName } }}
          canCollect={canCollect}
          openRecordPayment={openRecordPayment}
          openEditInvoice={openEditInvoice}
          nested
        />
      ))}
    </>
  );
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
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(8);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(() => new Set());
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
    'invoices' | 'completed' | 'defaulters' | 'challans' | 'fee-types' | 'structures'
  >('invoices');

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const handleInvoiceSearchChange = useCallback((value: string) => {
    setInvoiceSearch(value);
    setInvoicePage(1);
    setExpandedStudentIds(new Set());
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

  const { data: invoiceGroups, isLoading, error } = useQuery({
    queryKey: [
      'fee-invoices-by-student',
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
      apiClient<PaginatedResponse<StudentInvoiceGroup>>(
        withBranchScope('/fee-invoices/by-student', effectiveScope, {
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

  const toggleStudentExpanded = useCallback((studentId: string) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

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

  const { data: defaultersSummary, isLoading: defaultersSummaryLoading } = useQuery({
    queryKey: [
      ...queryKeys.reportsFeeDefaultersSummary({
        scopeKey,
        search: defaulterSearch,
        dueFrom: defaulterDueFrom,
        dueTo: defaulterDueTo,
      }),
    ],
    queryFn: () =>
      apiClient<FeeDefaultersSummaryResponse>(
        withBranchScope('/reports/fee-defaulters/summary', effectiveScope, {
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

  const openEditInvoice = (invoiceId: string) => {
    setEditInvoiceId(invoiceId);
  };

  const handleLimitChange = useCallback((next: number) => {
    setInvoiceLimit(next);
    setInvoicePage(1);
    setExpandedStudentIds(new Set());
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

      <EditInvoiceDialog
        open={!!editInvoiceId}
        onOpenChange={(open) => {
          if (!open) setEditInvoiceId(null);
        }}
        invoiceId={editInvoiceId}
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
            { id: 'challans', label: 'Challans' },
            { id: 'defaulters', label: 'Fee Defaulter' },
            { id: 'fee-types', label: 'Fee types' },
            { id: 'structures', label: 'Structures' },
          ]}
          value={tab}
          onValueChange={(id) =>
            setTab(
              id as 'invoices' | 'completed' | 'challans' | 'defaulters' | 'fee-types' | 'structures',
            )
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
                setExpandedStudentIds(new Set());
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
                setExpandedStudentIds(new Set());
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
                setExpandedStudentIds(new Set());
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
                setExpandedStudentIds(new Set());
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
                  setExpandedStudentIds(new Set());
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

                  {!isLoading && !error && invoiceGroups?.data.length === 0 && (
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
                    invoiceGroups?.data.map((group) => {
                      const expanded = expandedStudentIds.has(group.student.id);
                      const moreCount = Math.max(0, group.totals.invoiceCount - group.preview.length);
                      const previewIds = new Set(group.preview.map((inv) => inv.id));
                      return (
                        <Fragment key={group.student.id}>
                          <tr className="bg-[var(--bg-weak-50,#F8F9FB)]">
                            <td colSpan={7} className={cn(dataTableTdClass, 'py-2.5')}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {moreCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleStudentExpanded(group.student.id)}
                                      className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm font-medium text-[var(--text-main-900,#0A0D14)] hover:bg-white"
                                      aria-expanded={expanded}
                                    >
                                      <ChevronDown
                                        className={cn(
                                          'h-4 w-4 shrink-0 transition-transform',
                                          expanded && 'rotate-180',
                                        )}
                                      />
                                      <span className="truncate">{group.student.fullName}</span>
                                    </button>
                                  ) : (
                                    <span className="truncate text-sm font-medium text-[var(--text-main-900,#0A0D14)]">
                                      {group.student.fullName}
                                    </span>
                                  )}
                                  {group.student.admissionNumber ? (
                                    <span className="text-xs text-[var(--base-muted-foreground,#71717A)]">
                                      En. {group.student.admissionNumber}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--base-muted-foreground,#71717A)]">
                                  <span>
                                    {group.totals.invoiceCount} invoice
                                    {group.totals.invoiceCount === 1 ? '' : 's'}
                                  </span>
                                  <span>
                                    Open {formatCurrency(group.totals.openBalance)}
                                  </span>
                                  {moreCount > 0 && !expanded ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleStudentExpanded(group.student.id)}
                                      className="font-medium text-[var(--primary-base,#375DFB)] hover:underline"
                                    >
                                      Show {moreCount} more
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                          {group.preview.map((inv) => (
                            <InvoiceTableRow
                              key={inv.id}
                              inv={{
                                ...inv,
                                student: inv.student ?? { fullName: group.student.fullName },
                              }}
                              canCollect={canCollect}
                              openRecordPayment={openRecordPayment}
                              openEditInvoice={openEditInvoice}
                              nested
                            />
                          ))}
                          {expanded && moreCount > 0 ? (
                            <StudentInvoiceExpandRows
                              studentId={group.student.id}
                              studentName={group.student.fullName}
                              previewIds={previewIds}
                              filters={{
                                scope: effectiveScope,
                                statusId,
                                feeTypeId,
                                dueFrom,
                                dueTo,
                                search: invoiceSearch,
                              }}
                              canCollect={canCollect}
                              openRecordPayment={openRecordPayment}
                              openEditInvoice={openEditInvoice}
                              token={token}
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {invoiceGroups && (
              <PaginationBar
                page={invoicePage}
                totalPages={invoiceGroups.meta.totalPages}
                limit={invoiceLimit}
                onPageChange={(p) => {
                  setInvoicePage(p);
                  setExpandedStudentIds(new Set());
                }}
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
                              ...(canCollect
                                ? [
                                    {
                                      label: 'Edit',
                                      onClick: () => openEditInvoice(inv.id),
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

      {tab === 'challans' && <FeeChallansPanel />}

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
          {(() => {
            const outstanding = stats?.outstandingAmount.total ?? 0;
            const collected = stats?.collectedLast30Days.total ?? 0;
            const healthTotal = outstanding + collected;
            const aging = defaultersSummary?.aging ?? [];
            const agingTotal = aging.reduce((sum, b) => sum + b.remainingAmount, 0);
            const agingColors: Record<string, string> = {
              '0-30': '#F59E0B',
              '31-60': '#F97316',
              '61+': '#DC2626',
            };
            const agingLabels: Record<string, string> = {
              '0-30': '0–30 days',
              '31-60': '31–60 days',
              '61+': '61+ days',
            };
            const trendPoints = (defaultersSummary?.trend ?? []).map((p) => ({
              label: monthLabel(p.month),
              value: p.remainingAmount,
            }));
            const trendCurrent = trendPoints[trendPoints.length - 1]?.value ?? 0;
            const trendPrevious = trendPoints[trendPoints.length - 2]?.value ?? 0;
            const trendChange =
              trendPrevious > 0
                ? Math.round(((trendCurrent - trendPrevious) / trendPrevious) * 1000) / 10
                : null;

            return (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <MetricDonutCard
                    title="Collection health"
                    subtitle="Outstanding vs collected (30d)"
                    isLoading={statsLoading}
                    segments={[
                      {
                        label: 'Outstanding',
                        rate: sharePercent(outstanding, healthTotal),
                        color: '#DC2626',
                      },
                      {
                        label: 'Collected',
                        rate: sharePercent(collected, healthTotal),
                        color: '#16A34A',
                      },
                    ]}
                  />
                  <MetricDonutCard
                    title="Overdue aging"
                    subtitle="Unpaid by days past due"
                    isLoading={defaultersSummaryLoading}
                    segments={
                      agingTotal > 0
                        ? aging.map((b) => ({
                            label: agingLabels[b.bucket] ?? b.bucket,
                            rate: sharePercent(b.remainingAmount, agingTotal),
                            color: agingColors[b.bucket] ?? '#71717A',
                          }))
                        : [
                            { label: '0–30 days', rate: 0, color: '#F59E0B' },
                            { label: '31–60 days', rate: 0, color: '#F97316' },
                            { label: '61+ days', rate: 0, color: '#DC2626' },
                          ]
                    }
                  />
                </div>
                <TrendAreaChart
                  title="Overdue remaining"
                  subtitle="By due month · last 6 months"
                  data={trendPoints}
                  changePercent={trendChange}
                  isLoading={defaultersSummaryLoading}
                  valueFormatter={(v) => formatCurrencyCompact(v)}
                  gradientId="feesDefaultersOverdueGradient"
                  totalLabel="Latest month"
                  totalValue={formatCurrencyCompact(trendCurrent)}
                />
                {!defaultersSummaryLoading &&
                  agingTotal <= 0 &&
                  trendPoints.every((p) => p.value <= 0) && (
                    <p className="text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No overdue amounts to chart for the current filters.
                    </p>
                  )}
              </>
            );
          })()}

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
                                  label: 'Edit',
                                  onClick: () => openEditInvoice(inv.id),
                                },
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
