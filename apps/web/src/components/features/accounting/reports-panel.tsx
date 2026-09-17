'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { downloadCsv } from '@/lib/download-csv';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { seedRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import type { PaginatedResponse } from '@eims/types';
import type { AccountingAccount, Budget } from './types';
import { formatMoney } from './types';

function csvRow(values: unknown[]): (string | number | null | undefined)[] {
  return values.map((value) =>
    value == null || typeof value === 'string' || typeof value === 'number' ? value : String(value),
  );
}

const REPORTS = [
  { id: 'trial-balance', label: 'Trial balance' },
  { id: 'income-expense', label: 'Income & expense' },
  { id: 'account-statement', label: 'Account statement (ledger)' },
  { id: 'budget-vs-actual', label: 'Budget vs actual' },
] as const;

type ReportId = (typeof REPORTS)[number]['id'];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function ReportsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const range = useMemo(() => defaultDateRange(), []);
  const [report, setReport] = useState<ReportId>('trial-balance');
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [accountId, setAccountId] = useState('');
  const [budgetId, setBudgetId] = useState('');

  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accountingAccounts(branchId),
    queryFn: () =>
      apiClient<PaginatedResponse<AccountingAccount>>(
        `/accounting/accounts?branchId=${branchId}&activeOnly=true&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const { data: budgetsData } = useQuery({
    queryKey: queryKeys.accountingBudgets(branchId),
    queryFn: () =>
      apiClient<PaginatedResponse<Budget>>(
        `/accounting/budgets?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const queryKey = ['accounting-report', report, branchId, from, to, accountId, budgetId];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ branchId });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (report === 'account-statement' && accountId) params.set('accountId', accountId);
      if (report === 'budget-vs-actual' && budgetId) params.set('budgetId', budgetId);

      const path =
        report === 'trial-balance'
          ? '/accounting/reports/trial-balance'
          : report === 'income-expense'
            ? '/accounting/reports/income-expense'
            : report === 'account-statement'
              ? '/accounting/reports/account-statement'
              : '/accounting/reports/budget-vs-actual';

      return apiClient<Record<string, unknown>>(`${path}?${params.toString()}`, { token });
    },
    enabled:
      !!token &&
      !!branchId &&
      (report !== 'account-statement' || !!accountId) &&
      (report !== 'budget-vs-actual' || !!budgetId || (budgetsData?.data.length ?? 0) > 0),
  });

  const accountOptions = (accountsData?.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));

  const budgetOptions = (budgetsData?.data ?? []).map((b) => ({
    value: b.id,
    label: `${b.year} — ${b.name}`,
  }));

  const handleExport = () => {
    if (!data) return;

    if (report === 'trial-balance') {
      const rows = (data.rows as Array<Record<string, unknown>>) ?? [];
      downloadCsv(
        'trial-balance.csv',
        ['Code', 'Name', 'Type', 'Debit', 'Credit', 'Balance'],
        rows.map((row) =>
          csvRow([row.code, row.name, row.type, row.debit, row.credit, row.balance]),
        ),
      );
      return;
    }

    if (report === 'income-expense') {
      const income = (data.income as Array<Record<string, unknown>>) ?? [];
      const expense = (data.expense as Array<Record<string, unknown>>) ?? [];
      const drawings = (data.drawings as Array<Record<string, unknown>>) ?? [];
      const totals = (data.totals as { income?: number; expense?: number; drawings?: number; net?: number }) ?? {};
      downloadCsv(
        'income-expense.csv',
        ['Section', 'Code', 'Name', 'Amount'],
        [
          ...income.map((row) => csvRow(['Income', row.code, row.name, row.amount])),
          ...expense.map((row) => csvRow(['Expense', row.code, row.name, row.amount])),
          ...drawings.map((row) => csvRow(['Drawings', row.code, row.name, row.amount])),
          csvRow(['Profit', '', '', totals.net ?? 0]),
        ],
      );
      return;
    }

    if (report === 'account-statement') {
      const entries = (data.entries as Array<Record<string, unknown>>) ?? [];
      downloadCsv(
        'account-statement.csv',
        ['Date', 'Voucher', 'Narration', 'Debit', 'Credit', 'Balance'],
        entries.map((row) =>
          csvRow([
            row.voucherDate,
            row.voucherNo,
            row.narration,
            row.debit,
            row.credit,
            row.balance,
          ]),
        ),
      );
      return;
    }

    const rows = (data.rows as Array<Record<string, unknown>>) ?? [];
    downloadCsv(
      'budget-vs-actual.csv',
      ['Code', 'Name', 'Type', 'Budget', 'Actual', 'Variance'],
      rows.map((row) => csvRow([row.code, row.name, row.type, row.budget, row.actual, row.variance])),
    );
  };

  return (
    <ContentPanel
      title="Financial reports"
      actions={
        <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={!data}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4 border-b border-stroke-soft-200 px-5 py-4">
        <FilterBar>
          <SelectDropdown
            aria-label="Report type"
            value={report}
            onValueChange={(value) => setReport(value as ReportId)}
            options={REPORTS.map((r) => ({ value: r.id, label: r.label }))}
            className="w-full sm:w-[260px]"
          />
          {report !== 'budget-vs-actual' ? (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-[160px]" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-[160px]" />
            </>
          ) : (
            <SelectDropdown
              aria-label="Budget"
              placeholder="Select budget"
              value={budgetId || budgetOptions[0]?.value || ''}
              onValueChange={setBudgetId}
              options={budgetOptions}
              className="w-full sm:w-[260px]"
            />
          )}
          {report === 'account-statement' ? (
            <SelectDropdown
              aria-label="Account"
              placeholder="Select account"
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
              className="w-full sm:w-[260px]"
            />
          ) : null}
        </FilterBar>
      </div>

      {error ? (
        <p className="px-5 py-8 text-sm text-red-600">Unable to load report.</p>
      ) : isLoading ? (
        <p className="px-5 py-8 text-sm text-[var(--text-sub-500)]">Loading report…</p>
      ) : report === 'trial-balance' ? (
        <ReportTable
          headers={['Code', 'Name', 'Type', 'Debit', 'Credit', 'Balance']}
          rows={((data?.rows as Array<Record<string, unknown>>) ?? []).map((row) =>
            csvRow([
              row.code,
              row.name,
              row.type,
              `PKR ${formatMoney(Number(row.debit))}`,
              `PKR ${formatMoney(Number(row.credit))}`,
              `PKR ${formatMoney(Number(row.balance))}`,
            ]),
          )}
        />
      ) : report === 'income-expense' ? (
        <div className="space-y-6 px-5 py-4">
          <ReportTable
            title="Income (fees)"
            headers={['Code', 'Name', 'Amount']}
            rows={((data?.income as Array<Record<string, unknown>>) ?? []).map((row) =>
              csvRow([row.code, row.name, `PKR ${formatMoney(Number(row.amount))}`]),
            )}
          />
          <ReportTable
            title="Expense"
            headers={['Code', 'Name', 'Amount']}
            rows={((data?.expense as Array<Record<string, unknown>>) ?? []).map((row) =>
              csvRow([row.code, row.name, `PKR ${formatMoney(Number(row.amount))}`]),
            )}
          />
          <ReportTable
            title="Drawings"
            headers={['Code', 'Name', 'Amount']}
            rows={((data?.drawings as Array<Record<string, unknown>>) ?? []).map((row) =>
              csvRow([row.code, row.name, `PKR ${formatMoney(Number(row.amount))}`]),
            )}
          />
          <div className="space-y-1 text-sm">
            <p>
              Income: PKR {formatMoney(Number((data?.totals as { income?: number })?.income ?? 0))}
            </p>
            <p>
              Expenses: PKR {formatMoney(Number((data?.totals as { expense?: number })?.expense ?? 0))}
            </p>
            <p>
              Drawings: PKR {formatMoney(Number((data?.totals as { drawings?: number })?.drawings ?? 0))}
            </p>
            <p className="font-medium">
              Profit: PKR {formatMoney(Number((data?.totals as { net?: number })?.net ?? 0))}
            </p>
          </div>
        </div>
      ) : report === 'account-statement' ? (
        <ReportTable
          headers={['Date', 'Voucher', 'Narration', 'Debit', 'Credit', 'Balance']}
          rows={((data?.entries as Array<Record<string, unknown>>) ?? []).map((row) =>
            csvRow([
              row.voucherDate,
              row.voucherNo,
              row.narration ?? '—',
              row.debit ? `PKR ${formatMoney(Number(row.debit))}` : '—',
              row.credit ? `PKR ${formatMoney(Number(row.credit))}` : '—',
              `PKR ${formatMoney(Number(row.balance))}`,
            ]),
          )}
        />
      ) : (
        <ReportTable
          headers={['Code', 'Name', 'Type', 'Budget', 'Actual', 'Variance']}
          rows={((data?.rows as Array<Record<string, unknown>>) ?? []).map((row) =>
            csvRow([
              row.code,
              row.name,
              row.type,
              `PKR ${formatMoney(Number(row.budget))}`,
              `PKR ${formatMoney(Number(row.actual))}`,
              `PKR ${formatMoney(Number(row.variance))}`,
            ]),
          )}
        />
      )}
    </ContentPanel>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <div className="px-5 py-4">
      {title ? <h3 className="mb-3 text-sm font-medium">{title}</h3> : null}
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className={dataTableThClass}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyStateCell colSpan={headers.length} title="No data for selected filters." />
            ) : (
              rows.map((row, index) => (
                <tr key={index} className={seedRowClass(String(row[0] ?? index), index)}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={dataTableTdClass}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
