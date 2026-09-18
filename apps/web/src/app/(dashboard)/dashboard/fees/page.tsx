'use client';

import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Receipt } from 'lucide-react';
import { toast } from 'sonner';
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
  CommunicationCampaignQueuedResponse,
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
import { StatusBadge, statusRowAccentClass, statusRowClass } from '@/components/layout/status-badge';
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
import { FeeIncrementDialog } from '@/components/features/fees/fee-increment-dialog';
import { StudentFeePolicyDialog } from '@/components/features/fees/student-fee-policy-dialog';
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
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { queryKeys } from '@/lib/query-keys';
import { UserAvatar } from '@/components/layout/user-avatar';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { openBulkInvoicePrint } from '@/lib/bulk-invoice-print';

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
  lines?: Array<{ feeTypeId: string; label: string; amount: number }>;
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

function remainingClass(amount: number) {
  return amount > 0
    ? 'font-semibold text-[var(--palette-coral)]'
    : 'font-semibold text-[var(--palette-green)]';
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
  requestWaive?: (invoice: Invoice) => void,
  requestUnwaive?: (invoice: Invoice) => void,
) {
  const remaining = inv.remainingAmount ?? inv.netAmount;
  const statusCode = inv.status?.code;
  const canPay =
    canCollect && remaining > 0 && statusCode !== 'waived' && statusCode !== 'paid';
  const canWaive =
    canCollect && remaining > 0 && statusCode !== 'waived' && statusCode !== 'paid';
  const canUnwaive = canCollect && statusCode === 'waived';

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
    ...(canPay
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
    ...(canWaive && requestWaive
      ? [
          {
            label: 'Waive remaining',
            onClick: () => requestWaive(inv),
          },
        ]
      : []),
    ...(canUnwaive && requestUnwaive
      ? [
          {
            label: 'Unwaive',
            onClick: () => requestUnwaive(inv),
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
  requestWaive,
  requestUnwaive,
  nested,
  selected,
  onToggleSelect,
}: {
  inv: Invoice;
  canCollect: boolean;
  openRecordPayment: (invoice: PayInvoiceTarget, mode?: PaymentDialogMode) => void;
  openEditInvoice?: (invoiceId: string) => void;
  requestWaive?: (invoice: Invoice) => void;
  requestUnwaive?: (invoice: Invoice) => void;
  nested?: boolean;
  selected?: boolean;
  onToggleSelect?: (invoiceId: string) => void;
}) {
  const remaining = inv.remainingAmount ?? inv.netAmount;
  const statusCode = inv.status?.code;
  const statusLabel = inv.status?.label ?? '';
  const isOverdue = `${statusCode ?? ''} ${statusLabel}`.toLowerCase().includes('overdue');
  const feeLabel =
    inv.lines && inv.lines.length > 0
      ? inv.lines.map((line) => line.label).join(', ')
      : (inv.feeType?.name ?? '—');

  return (
    <tr className={cn('transition-colors', statusRowClass(statusCode, statusLabel))}>
      {onToggleSelect ? (
        <td className={cn(dataTableTdClass, nested && 'pl-10')}>
          <input
            type="checkbox"
            aria-label={`Select invoice for ${inv.student?.fullName ?? 'student'}`}
            checked={Boolean(selected)}
            onChange={() => onToggleSelect(inv.id)}
          />
        </td>
      ) : null}
      <td
        className={cn(
          dataTableTdClass,
          nested && cn(statusRowAccentClass(statusCode, statusLabel), 'pl-10 text-[var(--base-muted-foreground,#71717A)]'),
        )}
      >
        {nested ? '' : (inv.student?.fullName ?? '—')}
      </td>
      <td className={dataTableTdClass}>{feeLabel}</td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>{formatCurrency(inv.netAmount)}</td>
      <td className={cn(dataTableTdClass, 'whitespace-nowrap', remainingClass(remaining))}>
        {formatCurrency(remaining)}
      </td>
      <td
        className={cn(
          dataTableTdClass,
          'whitespace-nowrap',
          isOverdue && 'font-medium text-[var(--palette-coral)]',
        )}
      >
        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
      </td>
      <td className={dataTableTdClass}>
        {inv.status ? <StatusBadge label={inv.status.label} code={inv.status.code} /> : '—'}
      </td>
      <td className={cn(dataTableTdClass, 'text-right')}>
        <RowActionsMenu
          items={invoiceRowActions(
            inv,
            canCollect,
            openRecordPayment,
            openEditInvoice,
            requestWaive,
            requestUnwaive,
          )}
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
  requestWaive,
  requestUnwaive,
  token,
  selectedIds,
  onToggleSelect,
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
  requestWaive?: (invoice: Invoice) => void;
  requestUnwaive?: (invoice: Invoice) => void;
  token: string | undefined;
  selectedIds?: Set<string>;
  onToggleSelect?: (invoiceId: string) => void;
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
        <td colSpan={8} className="px-4 py-3 pl-10 text-sm text-[var(--base-muted-foreground,#71717A)]">
          Loading more invoices for {studentName}…
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3 pl-10 text-sm text-red-600">
          Failed to load remaining invoices
        </td>
      </tr>
    );
  }

  if (rest.length === 0) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3 pl-10 text-sm text-[var(--base-muted-foreground,#71717A)]">
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
          requestWaive={requestWaive}
          requestUnwaive={requestUnwaive}
          nested
          selected={selectedIds?.has(inv.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </>
  );
}

export default function FeesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canCollect = can(PERMISSIONS.FEES_COLLECT);
  const canSendComms = can(PERMISSIONS.COMMUNICATIONS_SEND);
  const [remindOpen, setRemindOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [incrementOpen, setIncrementOpen] = useState(false);
  const [feePolicyOpen, setFeePolicyOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<PayInvoiceTarget | null>(null);
  const [payMode, setPayMode] = useState<PaymentDialogMode>('partial');
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'waive' | 'unwaive';
    invoice: Invoice;
  } | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(8);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusId, setStatusId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(() => new Set());
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(() => new Set());
  const [expandedDefaulterIds, setExpandedDefaulterIds] = useState<Set<string>>(() => new Set());
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

  const toggleInvoiceSelected = useCallback((invoiceId: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }, []);

  const toggleDefaulterExpanded = useCallback((studentId: string) => {
    setExpandedDefaulterIds((prev) => {
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
          student: { id: string; fullName: string };
          totalRemaining: number;
          invoiceCount: number;
          invoices: Array<{
            id: string;
            feeType?: { name: string } | null;
            netAmount: number;
            remainingAmount?: number;
            dueDate: string | null;
          }>;
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

  const requestWaive = (invoice: Invoice) => {
    setConfirmAction({ type: 'waive', invoice });
  };

  const requestUnwaive = (invoice: Invoice) => {
    setConfirmAction({ type: 'unwaive', invoice });
  };

  const waiveMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient(withBranchScope(`/fee-invoices/${invoiceId}/waive`, effectiveScope), {
        method: 'PATCH',
        token,
      }),
    onSuccess: () => {
      toast.success('Remaining balance waived');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-completed'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsFeeDefaulters() });
      setConfirmAction(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unwaiveMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient(withBranchScope(`/fee-invoices/${invoiceId}/unwaive`, effectiveScope), {
        method: 'PATCH',
        token,
      }),
    onSuccess: () => {
      toast.success('Invoice unwaived');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-student'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-completed'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsFeeDefaulters() });
      setConfirmAction(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: reminderPreview } = useQuery({
    queryKey: ['comms-preview-fee-defaulters', scopeKey, remindOpen],
    queryFn: () =>
      apiClient<{ count: number }>(
        withBranchScope('/communications/preview-audience', effectiveScope),
        { method: 'POST', token, body: { audience: 'fee_defaulters' } },
      ),
    enabled: !!token && remindOpen && canSendComms,
  });

  const remindMutation = useMutation({
    mutationFn: () =>
      apiClient<CommunicationCampaignQueuedResponse>(
        withBranchScope('/communications/fee-reminders', effectiveScope),
        { method: 'POST', token, body: { channel: 'whatsapp', smsFallback: false } },
      ),
    onSuccess: (res) => {
      toast.success(`Queued ${res.queued} fee reminder${res.queued === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.communicationsStats });
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      setRemindOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
                onClick={() => setIncrementOpen(true)}
                className={pageHeaderActionClassName}
              >
                Fee increment
              </button>
              <button
                type="button"
                onClick={() => setFeePolicyOpen(true)}
                className={pageHeaderActionClassName}
              >
                Student fee
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
        onGenerated={({ invoiceIds }) => {
          setTab('invoices');
          setInvoicePage(1);
          setExpandedStudentIds(new Set());
          setSelectedInvoiceIds(new Set(invoiceIds));
        }}
      />

      <FeeIncrementDialog
        open={incrementOpen}
        onOpenChange={setIncrementOpen}
        branchId={singleBranchId ?? ''}
        scope={effectiveScope}
        canAllCampuses={effectiveScope.kind === 'all'}
      />

      <StudentFeePolicyDialog
        open={feePolicyOpen}
        onOpenChange={setFeePolicyOpen}
        branchId={singleBranchId ?? ''}
        scope={effectiveScope}
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

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !waiveMutation.isPending && !unwaiveMutation.isPending) {
            setConfirmAction(null);
          }
        }}
        title={confirmAction?.type === 'unwaive' ? 'Unwaive invoice' : 'Waive remaining'}
        description={
          confirmAction?.type === 'unwaive'
            ? 'Restore this waived invoice to pending. Only unpaid waived invoices can be unwaived.'
            : 'Set remaining balance to zero. Succeeded payments stay. You can unwaive later if nothing has been paid after this.'
        }
        confirmLabel={confirmAction?.type === 'unwaive' ? 'Unwaive' : 'Waive remaining'}
        loading={waiveMutation.isPending || unwaiveMutation.isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === 'unwaive') {
            unwaiveMutation.mutate(confirmAction.invoice.id);
          } else {
            waiveMutation.mutate(confirmAction.invoice.id);
          }
        }}
      />

      <ConfirmDialog
        open={remindOpen}
        onOpenChange={(open) => {
          if (!open && !remindMutation.isPending) setRemindOpen(false);
        }}
        title="Send fee reminders"
        description={`Queue WhatsApp alerts to ${reminderPreview?.count ?? 0} fee-defaulter contact${(reminderPreview?.count ?? 0) === 1 ? '' : 's'} in this branch.`}
        confirmLabel="Send reminders"
        loading={remindMutation.isPending}
        onConfirm={() => {
          if (!reminderPreview?.count) {
            toast.error('No fee-defaulter contacts to notify');
            return;
          }
          remindMutation.mutate();
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
            <Button
              type="button"
              variant="ghost"
              disabled={selectedInvoiceIds.size === 0}
              onClick={() => openBulkInvoicePrint([...selectedInvoiceIds])}
            >
              Print selected{selectedInvoiceIds.size ? ` (${selectedInvoiceIds.size})` : ''}
            </Button>
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={cn(dataTableThClass, 'w-10')} />
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
                  {isLoading && <DataTableSkeletonRows columns={8} rows={invoiceLimit} />}

                  {error && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-600">
                        Failed to load invoices
                      </td>
                    </tr>
                  )}

                  {!isLoading && !error && invoiceGroups?.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
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
                          <tr className="bg-[var(--palette-orange-soft)]">
                            <td colSpan={8} className={cn(dataTableTdClass, 'border-b-[var(--palette-orange)]/20 py-2.5')}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <UserAvatar
                                    name={group.student.fullName}
                                    seed={group.student.id}
                                    size="sm"
                                  />
                                  {moreCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleStudentExpanded(group.student.id)}
                                      className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm font-semibold text-[var(--palette-navy)] hover:bg-white/70"
                                      aria-expanded={expanded}
                                    >
                                      <ChevronDown
                                        className={cn(
                                          'h-4 w-4 shrink-0 text-[var(--palette-orange)] transition-transform',
                                          expanded && 'rotate-180',
                                        )}
                                      />
                                      <span className="truncate">{group.student.fullName}</span>
                                    </button>
                                  ) : (
                                    <span className="truncate text-sm font-semibold text-[var(--palette-navy)]">
                                      {group.student.fullName}
                                    </span>
                                  )}
                                  {group.student.admissionNumber ? (
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-[var(--palette-navy)]">
                                      En. {group.student.admissionNumber}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[var(--palette-teal-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--palette-teal)]">
                                    {group.totals.invoiceCount} invoice
                                    {group.totals.invoiceCount === 1 ? '' : 's'}
                                  </span>
                                  <span
                                    className={cn(
                                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                      group.totals.openBalance > 0
                                        ? 'bg-[var(--palette-coral-soft)] text-[var(--palette-coral)]'
                                        : 'bg-[var(--palette-green-soft)] text-[var(--palette-green)]',
                                    )}
                                  >
                                    Open {formatCurrency(group.totals.openBalance)}
                                  </span>
                                  {moreCount > 0 && !expanded ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleStudentExpanded(group.student.id)}
                                      className="text-xs font-semibold text-[var(--palette-teal)] hover:underline"
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
                              requestWaive={requestWaive}
                              requestUnwaive={requestUnwaive}
                              nested
                              selected={selectedInvoiceIds.has(inv.id)}
                              onToggleSelect={toggleInvoiceSelected}
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
                              requestWaive={requestWaive}
                              requestUnwaive={requestUnwaive}
                              token={token}
                              selectedIds={selectedInvoiceIds}
                              onToggleSelect={toggleInvoiceSelected}
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
                      <tr
                        key={inv.id}
                        className={cn(
                          'transition-colors',
                          statusRowClass(inv.status?.code ?? 'paid', inv.status?.label ?? 'Paid'),
                        )}
                      >
                        <td className={dataTableTdClass}>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar name={inv.student?.fullName} size="sm" />
                            <span className="truncate">{inv.student?.fullName ?? '—'}</span>
                          </div>
                        </td>
                        <td className={dataTableTdClass}>{inv.feeType?.name ?? '—'}</td>
                        <td className={cn(dataTableTdClass, 'whitespace-nowrap font-semibold text-[var(--palette-green)]')}>
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
              '0-30': 'var(--palette-yellow)',
              '31-60': 'var(--palette-orange)',
              '61+': 'var(--palette-coral)',
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
                        color: 'var(--palette-coral)',
                      },
                      {
                        label: 'Collected',
                        rate: sharePercent(collected, healthTotal),
                        color: 'var(--palette-green)',
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
                            color: agingColors[b.bucket] ?? 'var(--text-soft-400)',
                          }))
                        : [
                            { label: '0–30 days', rate: 0, color: 'var(--palette-yellow)' },
                            { label: '31–60 days', rate: 0, color: 'var(--palette-orange)' },
                            { label: '61+ days', rate: 0, color: 'var(--palette-coral)' },
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
            {canSendComms ? (
              <Button type="button" onClick={() => setRemindOpen(true)}>
                Send reminders
              </Button>
            ) : null}
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[640px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Invoices</th>
                    <th className={dataTableThClass}>Total remaining</th>
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
                    defaulters?.data.map((group) => {
                      const expanded = expandedDefaulterIds.has(group.student.id);
                      const canExpand = group.invoiceCount > 0;
                      return (
                        <Fragment key={group.student.id}>
                          <tr className={cn('transition-colors', statusRowClass('overdue', 'Overdue'))}>
                            <td className={dataTableTdClass}>
                              <div className="flex min-w-0 items-center gap-2.5">
                                <UserAvatar name={group.student.fullName} seed={group.student.id} size="sm" />
                                {canExpand ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleDefaulterExpanded(group.student.id)}
                                    className="inline-flex min-w-0 items-center gap-1.5 text-left text-sm font-semibold"
                                    aria-expanded={expanded}
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'h-4 w-4 shrink-0 text-[var(--palette-coral)] transition-transform',
                                        expanded && 'rotate-180',
                                      )}
                                    />
                                    <span className="truncate">{group.student.fullName}</span>
                                  </button>
                                ) : (
                                  <span className="truncate">{group.student.fullName}</span>
                                )}
                              </div>
                            </td>
                            <td className={dataTableTdClass}>
                              {group.invoiceCount} invoice{group.invoiceCount === 1 ? '' : 's'}
                            </td>
                            <td className={cn(dataTableTdClass, 'whitespace-nowrap', remainingClass(group.totalRemaining))}>
                              {formatCurrency(group.totalRemaining)}
                            </td>
                            <td className={cn(dataTableTdClass, 'text-right')} />
                          </tr>
                          {expanded
                            ? group.invoices.map((inv) => (
                                <tr key={inv.id} className={cn('transition-colors', statusRowClass('overdue', 'Overdue'))}>
                                  <td className={cn(dataTableTdClass, 'pl-10 text-[var(--base-muted-foreground,#71717A)]')}>
                                    {inv.feeType?.name ?? 'Invoice'}
                                  </td>
                                  <td className={cn(dataTableTdClass, 'whitespace-nowrap font-medium text-[var(--palette-coral)]')}>
                                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                                  </td>
                                  <td className={cn(dataTableTdClass, 'whitespace-nowrap', remainingClass(inv.remainingAmount ?? inv.netAmount))}>
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
                                            onClick: () =>
                                              openRecordPayment(
                                                toPayTarget({
                                                  id: inv.id,
                                                  netAmount: inv.netAmount,
                                                  remainingAmount: inv.remainingAmount,
                                                  student: group.student,
                                                }),
                                                'partial',
                                              ),
                                          },
                                          {
                                            label: 'Pay in full',
                                            onClick: () =>
                                              openRecordPayment(
                                                toPayTarget({
                                                  id: inv.id,
                                                  netAmount: inv.netAmount,
                                                  remainingAmount: inv.remainingAmount,
                                                  student: group.student,
                                                }),
                                                'full',
                                              ),
                                          },
                                          {
                                            label: 'Waive remaining',
                                            onClick: () =>
                                              requestWaive({
                                                id: inv.id,
                                                netAmount: inv.netAmount,
                                                remainingAmount: inv.remainingAmount,
                                                dueDate: inv.dueDate,
                                                student: group.student,
                                                paidAt: null,
                                              }),
                                          },
                                        ]}
                                      />
                                    ) : null}
                                  </td>
                                </tr>
                              ))
                            : null}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {defaulters?.meta && (
              <PaginationBar
                page={defaulterPage}
                totalPages={defaulters.meta.totalPages}
                limit={defaulterLimit}
                onPageChange={(p) => {
                  setDefaulterPage(p);
                  setExpandedDefaulterIds(new Set());
                }}
                onLimitChange={handleDefaulterLimitChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
