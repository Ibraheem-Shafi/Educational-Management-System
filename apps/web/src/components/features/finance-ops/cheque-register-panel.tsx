'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  bankStatementStatuses,
  createBankStatementLineSchema,
  createBankStatementSchema,
  formatCurrency,
  PERMISSIONS,
} from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ContentPanel } from '@/components/layout/content-panel';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { PageHeaderActionIcon, pageHeaderActionClassName } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { todayYmd } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type ChequeLine = {
  id: string;
  issueDate: string;
  chequeNumber: string;
  payee: string;
  onAccountOf: string;
  amount: number;
  useInCampus: string | null;
  clearingDate: string | null;
};

type ChequeRegister = {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  bankName: string;
  chequeBookNo: string;
  chequeBookSerialFrom: string | null;
  chequeBookSerialTo: string | null;
  serialRange: string | null;
  status: string;
  lineCount: number;
  total: number;
  lines?: ChequeLine[];
};

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const emptyRegisterForm = () => {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    bankName: '',
    chequeBookNo: '',
    chequeBookSerialFrom: '',
    chequeBookSerialTo: '',
    status: 'open',
  };
};

const emptyLineForm = () => ({
  issueDate: todayYmd(),
  chequeNumber: '',
  payee: '',
  onAccountOf: '',
  amount: '',
  useInCampus: '',
  clearingDate: '',
});

export function ChequeRegisterPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);

  const listParams = { branchId, page, limit };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.opsRecords('bank-statements', branchId, listParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      return apiClient<PaginatedResponse<ChequeRegister>>(`/finance-ops/bank-statements?${params}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const { data: selected } = useQuery({
    queryKey: ['cheque-register', selectedId],
    queryFn: () => apiClient<ChequeRegister>(`/finance-ops/bank-statements/${selectedId}`, { token }),
    enabled: !!token && !!selectedId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.opsRecords('bank-statements', branchId) });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ['cheque-register', selectedId] });
    }
  };

  const deleteRegister = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/finance-ops/bank-statements/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Cheque register deleted');
      setSelectedId(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not delete cheque register');
    },
  });

  const deleteLine = useMutation({
    mutationFn: (lineId: string) =>
      apiClient(`/finance-ops/bank-statements/${selectedId}/lines/${lineId}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => {
      toast.success('Cheque removed');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not remove cheque');
    },
  });

  const rows = data?.data ?? [];
  const detail = selected ?? rows.find((row) => row.id === selectedId) ?? null;

  if (selectedId && detail) {
    const lines = detail.lines ?? [];
    return (
      <ContentPanel
        title={`Issued cheque record — ${detail.monthLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Registers
            </Button>
            <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
              <button
                type="button"
                onClick={() => setLineOpen(true)}
                className={pageHeaderActionClassName}
              >
                <PageHeaderActionIcon />
                Add cheque
              </button>
            </PermissionGate>
          </div>
        }
      >
        <div className="space-y-1 border-b border-stroke-soft-200 px-5 py-3 text-sm text-[var(--text-sub-500)]">
          <p>
            {detail.bankName}
            {detail.chequeBookNo ? ` · Book ${detail.chequeBookNo}` : ''}
            {detail.serialRange ? ` · Serial ${detail.serialRange}` : ''}
          </p>
        </div>
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                {['Sr #', 'Issue Date', 'Cheque Number', 'Payee/Receiver', 'On Account of', 'Amount', 'Use In Campus', 'Clearing Date', ''].map(
                  (header) => (
                    <th key={header} className={dataTableThClass}>
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <EmptyStateCell colSpan={9} title="No cheques issued in this book yet" />
              ) : (
                lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className={dataTableTdClass}>{index + 1}</td>
                    <td className={dataTableTdClass}>{line.issueDate}</td>
                    <td className={dataTableTdClass}>{line.chequeNumber}</td>
                    <td className={dataTableTdClass}>{line.payee}</td>
                    <td className={dataTableTdClass}>{line.onAccountOf}</td>
                    <td className={dataTableTdClass}>{formatCurrency(line.amount)}</td>
                    <td className={dataTableTdClass}>{line.useInCampus || '—'}</td>
                    <td className={dataTableTdClass}>{line.clearingDate || '—'}</td>
                    <td className={dataTableTdClass}>
                      <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Delete',
                              onClick: () => {
                                if (confirm('Remove this cheque?')) deleteLine.mutate(line.id);
                              },
                            },
                          ]}
                        />
                      </PermissionGate>
                    </td>
                  </tr>
                ))
              )}
              <tr>
                <td className={cn(dataTableTdClass, 'font-medium')} colSpan={5}>
                  Total
                </td>
                <td className={cn(dataTableTdClass, 'font-medium')}>{formatCurrency(detail.total)}</td>
                <td className={dataTableTdClass} colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
        <ChequeLineDialog
          open={lineOpen}
          onOpenChange={setLineOpen}
          registerId={detail.id}
          token={token}
          onSaved={invalidate}
        />
      </ContentPanel>
    );
  }

  return (
    <>
      <ContentPanel
        title="Issued cheque records"
        actions={
          <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
            <button type="button" onClick={() => setCreateOpen(true)} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Add register
            </button>
          </PermissionGate>
        }
      >
        {error ? (
          <p className="px-5 py-6 text-sm text-red-600">Could not load cheque registers.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    {['Month', 'Bank', 'Cheque book', 'Serial', 'Cheques', 'Total', 'Status', ''].map((header) => (
                      <th key={header} className={dataTableThClass}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={8} rows={limit} />
                  ) : rows.length === 0 ? (
                    <EmptyStateCell colSpan={8} title="No cheque registers yet" />
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className={dataTableTdClass}>
                          <button
                            type="button"
                            className="font-medium text-[var(--palette-teal)] hover:underline"
                            onClick={() => setSelectedId(row.id)}
                          >
                            {row.monthLabel}
                          </button>
                        </td>
                        <td className={dataTableTdClass}>{row.bankName}</td>
                        <td className={dataTableTdClass}>{row.chequeBookNo || '—'}</td>
                        <td className={dataTableTdClass}>{row.serialRange || '—'}</td>
                        <td className={dataTableTdClass}>{row.lineCount}</td>
                        <td className={dataTableTdClass}>{formatCurrency(row.total)}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge label={row.status} code={row.status} />
                        </td>
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
                            <RowActionsMenu
                              items={[
                                { label: 'Open', onClick: () => setSelectedId(row.id) },
                                {
                                  label: 'Delete',
                                  onClick: () => {
                                    if (confirm('Delete this cheque register?')) {
                                      deleteRegister.mutate(row.id);
                                    }
                                  },
                                },
                              ]}
                            />
                          </PermissionGate>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={page}
              limit={limit}
              totalPages={data?.meta?.totalPages ?? 1}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </>
        )}
      </ContentPanel>
      <RegisterDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={branchId}
        token={token}
        onSaved={invalidate}
      />
    </>
  );
}

function RegisterDialog({
  open,
  onOpenChange,
  branchId,
  token,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  token: string | null | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyRegisterForm);
  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(createBankStatementSchema);

  useEffect(() => {
    if (open) {
      setForm(emptyRegisterForm());
      clearAll();
    }
  }, [open, clearAll]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/finance-ops/bank-statements', { method: 'POST', token, body }),
    onSuccess: () => {
      toast.success('Cheque register created');
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err instanceof Error ? err.message : 'Could not save register');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      branchId,
      year: Number(form.year),
      month: Number(form.month),
      bankName: form.bankName.trim(),
      chequeBookNo: form.chequeBookNo.trim() || null,
      chequeBookSerialFrom: form.chequeBookSerialFrom.trim() || null,
      chequeBookSerialTo: form.chequeBookSerialTo.trim() || null,
      status: form.status,
    };
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Add cheque register</DialogTitle>
        <DialogDescription>Monthly issued cheque book for this campus.</DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormFieldLabel htmlFor="cheque-year" required>
                Year
              </FormFieldLabel>
              <Input
                id="cheque-year"
                type="number"
                value={form.year}
                onChange={(e) => {
                  clearField('year');
                  setForm((current) => ({ ...current, year: e.target.value }));
                }}
                className={fieldClassName('year', modalFieldClassName)}
              />
              <FormFieldError message={errors.year} />
            </div>
            <div>
              <FormFieldLabel required>Month</FormFieldLabel>
              <SelectDropdown
                aria-label="Month"
                fullWidth
                value={form.month}
                onValueChange={(value) => {
                  clearField('month');
                  setForm((current) => ({ ...current, month: value }));
                }}
                options={MONTH_OPTIONS}
              />
              <FormFieldError message={errors.month} />
            </div>
          </div>
          <div>
            <FormFieldLabel htmlFor="cheque-bank" required>
              Bank
            </FormFieldLabel>
            <Input
              id="cheque-bank"
              value={form.bankName}
              placeholder="Al Flah Bank"
              onChange={(e) => {
                clearField('bankName');
                setForm((current) => ({ ...current, bankName: e.target.value }));
              }}
              className={fieldClassName('bankName', modalFieldClassName)}
            />
            <FormFieldError message={errors.bankName} />
          </div>
          <div>
            <FormFieldLabel htmlFor="cheque-book">Cheque book no</FormFieldLabel>
            <Input
              id="cheque-book"
              value={form.chequeBookNo}
              onChange={(e) => setForm((current) => ({ ...current, chequeBookNo: e.target.value }))}
              className={modalFieldClassName}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormFieldLabel htmlFor="serial-from">Serial from</FormFieldLabel>
              <Input
                id="serial-from"
                value={form.chequeBookSerialFrom}
                onChange={(e) =>
                  setForm((current) => ({ ...current, chequeBookSerialFrom: e.target.value }))
                }
                className={modalFieldClassName}
              />
            </div>
            <div>
              <FormFieldLabel htmlFor="serial-to">Serial to</FormFieldLabel>
              <Input
                id="serial-to"
                value={form.chequeBookSerialTo}
                onChange={(e) =>
                  setForm((current) => ({ ...current, chequeBookSerialTo: e.target.value }))
                }
                className={modalFieldClassName}
              />
            </div>
          </div>
          <div>
            <FormFieldLabel>Status</FormFieldLabel>
            <SelectDropdown
              aria-label="Status"
              fullWidth
              value={form.status}
              onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
              options={bankStatementStatuses.map((status) => ({
                value: status,
                label: status,
              }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChequeLineDialog({
  open,
  onOpenChange,
  registerId,
  token,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerId: string;
  token: string | null | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyLineForm);
  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(createBankStatementLineSchema);

  useEffect(() => {
    if (open) {
      setForm(emptyLineForm());
      clearAll();
    }
  }, [open, clearAll]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient(`/finance-ops/bank-statements/${registerId}/lines`, { method: 'POST', token, body }),
    onSuccess: () => {
      toast.success('Cheque added');
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err instanceof Error ? err.message : 'Could not add cheque');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      issueDate: form.issueDate,
      chequeNumber: form.chequeNumber.trim(),
      payee: form.payee.trim(),
      onAccountOf: form.onAccountOf.trim(),
      amount: Number(form.amount),
      useInCampus: form.useInCampus.trim() || null,
      clearingDate: form.clearingDate || null,
    };
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Add issued cheque</DialogTitle>
        <DialogDescription>Record a cheque from this book.</DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormFieldLabel htmlFor="issue-date" required>
                Issue date
              </FormFieldLabel>
              <Input
                id="issue-date"
                type="date"
                value={form.issueDate}
                onChange={(e) => {
                  clearField('issueDate');
                  setForm((current) => ({ ...current, issueDate: e.target.value }));
                }}
                className={fieldClassName('issueDate', modalFieldClassName)}
              />
              <FormFieldError message={errors.issueDate} />
            </div>
            <div>
              <FormFieldLabel htmlFor="cheque-number" required>
                Cheque number
              </FormFieldLabel>
              <Input
                id="cheque-number"
                value={form.chequeNumber}
                onChange={(e) => {
                  clearField('chequeNumber');
                  setForm((current) => ({ ...current, chequeNumber: e.target.value }));
                }}
                className={fieldClassName('chequeNumber', modalFieldClassName)}
              />
              <FormFieldError message={errors.chequeNumber} />
            </div>
          </div>
          <div>
            <FormFieldLabel htmlFor="payee" required>
              Payee / receiver
            </FormFieldLabel>
            <Input
              id="payee"
              value={form.payee}
              onChange={(e) => {
                clearField('payee');
                setForm((current) => ({ ...current, payee: e.target.value }));
              }}
              className={fieldClassName('payee', modalFieldClassName)}
            />
            <FormFieldError message={errors.payee} />
          </div>
          <div>
            <FormFieldLabel htmlFor="on-account" required>
              On account of
            </FormFieldLabel>
            <Input
              id="on-account"
              value={form.onAccountOf}
              onChange={(e) => {
                clearField('onAccountOf');
                setForm((current) => ({ ...current, onAccountOf: e.target.value }));
              }}
              className={fieldClassName('onAccountOf', modalFieldClassName)}
            />
            <FormFieldError message={errors.onAccountOf} />
          </div>
          <div>
            <FormFieldLabel htmlFor="cheque-amount" required>
              Amount
            </FormFieldLabel>
            <Input
              id="cheque-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => {
                clearField('amount');
                setForm((current) => ({ ...current, amount: e.target.value }));
              }}
              className={fieldClassName('amount', modalFieldClassName)}
            />
            <FormFieldError message={errors.amount} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormFieldLabel htmlFor="use-campus">Use in campus</FormFieldLabel>
              <Input
                id="use-campus"
                value={form.useInCampus}
                onChange={(e) => setForm((current) => ({ ...current, useInCampus: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
            <div>
              <FormFieldLabel htmlFor="clearing-date">Clearing date</FormFieldLabel>
              <Input
                id="clearing-date"
                type="date"
                value={form.clearingDate}
                onChange={(e) => setForm((current) => ({ ...current, clearingDate: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}