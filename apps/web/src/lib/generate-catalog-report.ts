import type { BranchScope } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { withBranchScope } from '@/lib/branch-scope';
import { downloadCsv } from '@/lib/download-csv';
import type { ReportGenerateKey } from '@/lib/report-catalog';

export type GenerateCatalogReportContext = {
  token: string;
  scope: BranchScope;
  singleBranchId: string | null;
};

function cell(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function nested(row: unknown, path: string): string | number {
  let current: unknown = row;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  return cell(current);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function lastMonthRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function requireBranch(ctx: GenerateCatalogReportContext): string {
  if (!ctx.singleBranchId) {
    throw new Error('Select a single branch to generate this report');
  }
  return ctx.singleBranchId;
}

async function fetchAllPages<T>(
  path: string,
  ctx: GenerateCatalogReportContext,
  extra?: Record<string, string | number | undefined | null>,
): Promise<T[]> {
  const limit = 100;
  const first = await apiClient<PaginatedResponse<T>>(
    withBranchScope(path, ctx.scope, { ...extra, page: 1, limit }),
    { token: ctx.token },
  );
  const rows = [...(first.data ?? [])];
  const totalPages = Math.max(1, first.meta?.totalPages ?? 1);
  for (let page = 2; page <= totalPages && page <= 50; page += 1) {
    const next = await apiClient<PaginatedResponse<T>>(
      withBranchScope(path, ctx.scope, { ...extra, page, limit }),
      { token: ctx.token },
    );
    rows.push(...(next.data ?? []));
  }
  return rows;
}

async function generateStaffAttendanceCsv(
  ctx: GenerateCatalogReportContext,
  entityType: 'teacher' | 'staff',
  filename: string,
) {
  const branchId = requireBranch(ctx);
  const sheet = await apiClient<{
    date: string;
    members: Array<{
      fullName: string;
      attendance: { status: { label: string } | null; remarks: string | null } | null;
    }>;
  }>(
    withBranchScope('/attendance/staff-sheet', ctx.scope, {
      date: todayYmd(),
      branchId,
      entityType,
    }),
    { token: ctx.token },
  );
  downloadCsv(
    filename,
    ['Name', 'Status', 'Remarks', 'Date'],
    (sheet.members ?? []).map((member) => [
      member.fullName,
      member.attendance?.status?.label ?? 'Unmarked',
      member.attendance?.remarks ?? '',
      sheet.date,
    ]),
  );
}

async function generateIncomeExpenseCsv(
  ctx: GenerateCatalogReportContext,
  section: 'income' | 'expense' | 'both',
  filename: string,
) {
  const branchId = requireBranch(ctx);
  const range = lastMonthRange();
  const data = await apiClient<{
    income: Array<{ code: string; name: string; amount: number }>;
    expense: Array<{ code: string; name: string; amount: number }>;
    totals: { income: number; expense: number; net: number };
  }>(
    withBranchScope('/accounting/reports/income-expense', ctx.scope, {
      branchId,
      from: range.from,
      to: range.to,
    }),
    { token: ctx.token },
  );
  const rows: (string | number)[][] = [];
  if (section !== 'expense') {
    for (const row of data.income ?? []) {
      rows.push(['Income', row.code, row.name, row.amount]);
    }
    rows.push(['Income total', '', '', data.totals.income]);
  }
  if (section !== 'income') {
    for (const row of data.expense ?? []) {
      rows.push(['Expense', row.code, row.name, row.amount]);
    }
    rows.push(['Expense total', '', '', data.totals.expense]);
  }
  if (section === 'both') {
    rows.push(['Net', '', '', data.totals.net]);
  }
  downloadCsv(filename, ['Section', 'Code', 'Name', 'Amount'], rows);
}

export async function generateCatalogReport(
  key: ReportGenerateKey,
  ctx: GenerateCatalogReportContext,
): Promise<void> {
  switch (key) {
    case 'enrollment':
    case 'admissions-withdrawals': {
      const students = await fetchAllPages<Record<string, unknown>>('/students', ctx, {
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      downloadCsv(
        key === 'enrollment' ? 'student-enrollment.csv' : 'admissions-withdrawals.csv',
        ['Name', 'Admission no', 'Roll no', 'Batch', 'Program', 'Branch', 'Status', 'Enrolled'],
        students.map((row) => [
          nested(row, 'fullName'),
          nested(row, 'admissionNumber'),
          nested(row, 'rollNumber'),
          nested(row, 'batch.name'),
          nested(row, 'program.name'),
          nested(row, 'branch.name'),
          nested(row, 'status.label'),
          nested(row, 'createdAt'),
        ]),
      );
      return;
    }
    case 'student-attendance': {
      const month = currentMonth();
      const [stats, trend] = await Promise.all([
        apiClient<{
          todayRate: { total: number };
          monthAverage: { total: number };
          presentToday: { total: number };
          absentToday: { total: number };
        }>(withBranchScope('/attendance/stats', ctx.scope), { token: ctx.token }),
        apiClient<{ points: Array<{ label: string; value: number }> }>(
          withBranchScope('/attendance/trend', ctx.scope, { month }),
          { token: ctx.token },
        ),
      ]);
      downloadCsv(
        'student-attendance.csv',
        ['Metric', 'Value'],
        [
          ['Today present', stats.presentToday.total],
          ['Today absent', stats.absentToday.total],
          ["Today's rate %", stats.todayRate.total],
          ['Month average %', stats.monthAverage.total],
          ...trend.points.map((point) => [point.label, point.value]),
        ],
      );
      return;
    }
    case 'teacher-attendance':
      await generateStaffAttendanceCsv(ctx, 'teacher', 'teacher-attendance.csv');
      return;
    case 'staff-attendance':
      await generateStaffAttendanceCsv(ctx, 'staff', 'staff-attendance.csv');
      return;
    case 'assessments': {
      const assessments = await fetchAllPages<Record<string, unknown>>('/assessments', ctx);
      downloadCsv(
        'examination-assessment.csv',
        ['Name', 'Type', 'Status', 'Total marks', 'Conducted at'],
        assessments.map((row) => [
          nested(row, 'name'),
          nested(row, 'type.name'),
          nested(row, 'status'),
          nested(row, 'totalMarks'),
          nested(row, 'conductedAt'),
        ]),
      );
      return;
    }
    case 'performance': {
      const data = await apiClient<{
        students: Array<{ fullName: string; overallPercentage: number | null }>;
      }>(withBranchScope('/analytics/performance', ctx.scope), { token: ctx.token });
      downloadCsv(
        'student-performance.csv',
        ['Student', 'Overall percentage'],
        (data.students ?? []).map((row) => [row.fullName, row.overallPercentage ?? '']),
      );
      return;
    }
    case 'at-risk': {
      const data = await apiClient<{
        alerts: Array<{ fullName: string; subjectName: string; averagePercentage: number }>;
      }>(withBranchScope('/analytics/weak-subjects', ctx.scope, { threshold: 50 }), {
        token: ctx.token,
      });
      downloadCsv(
        'at-risk-students.csv',
        ['Student', 'Subject', 'Average %'],
        (data.alerts ?? []).map((row) => [row.fullName, row.subjectName, row.averagePercentage]),
      );
      return;
    }
    case 'top-performers': {
      const data = await apiClient<{
        rankings: Array<{
          assessment: { name: string };
          topStudents: Array<{ rank: number | null; fullName: string; percentage: number | null }>;
        }>;
      }>(withBranchScope('/analytics/rankings', ctx.scope), { token: ctx.token });
      downloadCsv(
        'top-performers.csv',
        ['Assessment', 'Rank', 'Student', 'Percentage'],
        (data.rankings ?? []).flatMap((group) =>
          (group.topStudents ?? []).map((row) => [
            group.assessment.name,
            row.rank ?? '',
            row.fullName,
            row.percentage ?? '',
          ]),
        ),
      );
      return;
    }
    case 'homework': {
      const items = await fetchAllPages<Record<string, unknown>>('/learning', ctx, {
        type: 'homework',
      });
      downloadCsv(
        'homework-assignments.csv',
        ['Title', 'Batch', 'Subject', 'Due at', 'Published', 'Max marks'],
        items.map((row) => [
          nested(row, 'title'),
          nested(row, 'batch.name'),
          nested(row, 'subject.name'),
          nested(row, 'dueAt'),
          nested(row, 'isPublished'),
          nested(row, 'maxMarks'),
        ]),
      );
      return;
    }
    case 'fee-collection': {
      const [stats, trend, overview] = await Promise.all([
        apiClient<{
          outstandingAmount: { total: number };
          collectedLast30Days: { total: number };
          overdueCount: { total: number };
          invoicesIssued: { total: number };
        }>(withBranchScope('/fees/stats', ctx.scope), { token: ctx.token }),
        apiClient<{ points: Array<{ label: string; value: number }> }>(
          withBranchScope('/fees/revenue-trend', ctx.scope),
          { token: ctx.token },
        ),
        apiClient<{
          fees: { collectedAmount: number; pendingAmount: number; paidCount: number; pendingCount: number };
        }>(withBranchScope('/reports/overview', ctx.scope), { token: ctx.token }),
      ]);
      downloadCsv(
        'fee-collection.csv',
        ['Metric', 'Value'],
        [
          ['Collected (all-time billed paid)', overview.fees.collectedAmount],
          ['Pending amount', overview.fees.pendingAmount],
          ['Paid invoices', overview.fees.paidCount],
          ['Pending invoices', overview.fees.pendingCount],
          ['Collected last 30 days', stats.collectedLast30Days.total],
          ['Outstanding amount', stats.outstandingAmount.total],
          ['Overdue invoices', stats.overdueCount.total],
          ['Invoices issued', stats.invoicesIssued.total],
          ...trend.points.map((point) => [`Trend ${point.label}`, point.value]),
        ],
      );
      return;
    }
    case 'fee-defaulters': {
      const groups = await fetchAllPages<Record<string, unknown>>('/reports/fee-defaulters', ctx);
      const rows = groups.flatMap((group) => {
        const invoices = Array.isArray(group.invoices)
          ? (group.invoices as Array<Record<string, unknown>>)
          : [];
        if (invoices.length === 0) {
          return [
            {
              student: nested(group, 'student.fullName'),
              phone: nested(group, 'student.phone'),
              feeType: '',
              amount: nested(group, 'totalRemaining'),
              dueDate: '',
            },
          ];
        }
        return invoices.map((invoice) => ({
          student: nested(group, 'student.fullName'),
          phone: nested(group, 'student.phone'),
          feeType: nested(invoice, 'feeType.name'),
          amount: nested(invoice, 'remainingAmount'),
          dueDate: nested(invoice, 'dueDate'),
        }));
      });
      downloadCsv(
        'fee-defaulters.csv',
        ['Student', 'Phone', 'Fee type', 'Amount', 'Due date'],
        rows.map((row) => [row.student, row.phone, row.feeType, row.amount, row.dueDate]),
      );
      return;
    }
    case 'monthly-income':
      await generateIncomeExpenseCsv(ctx, 'income', 'monthly-income.csv');
      return;
    case 'monthly-expense':
      await generateIncomeExpenseCsv(ctx, 'expense', 'monthly-expense.csv');
      return;
    case 'budget-vs-actual': {
      const branchId = requireBranch(ctx);
      const year = new Date().getFullYear();
      const budgets = await apiClient<PaginatedResponse<{ id: string; year: number; name: string }>>(
        withBranchScope('/accounting/budgets', ctx.scope, { branchId, limit: 100 }),
        { token: ctx.token },
      );
      const budget =
        (budgets.data ?? []).find((row) => row.year === year) ?? (budgets.data ?? [])[0];
      if (!budget) {
        throw new Error('No budget found for this branch');
      }
      const data = await apiClient<{
        rows: Array<{
          code: string;
          name: string;
          type: string;
          budget: number;
          actual: number;
          variance: number;
        }>;
      }>(
        withBranchScope('/accounting/reports/budget-vs-actual', ctx.scope, {
          branchId,
          budgetId: budget.id,
        }),
        { token: ctx.token },
      );
      downloadCsv(
        'budget-vs-actual.csv',
        ['Code', 'Name', 'Type', 'Budget', 'Actual', 'Variance'],
        (data.rows ?? []).map((row) => [
          row.code,
          row.name,
          row.type,
          row.budget,
          row.actual,
          row.variance,
        ]),
      );
      return;
    }
    case 'payroll': {
      const runs = await fetchAllPages<Record<string, unknown>>('/payroll/runs', ctx);
      downloadCsv(
        'payroll-salary.csv',
        ['Year', 'Month', 'Status', 'Lines', 'Finalized at'],
        runs.map((row) => [
          nested(row, 'year'),
          nested(row, 'month'),
          nested(row, 'status'),
          nested(row, 'lineCount'),
          nested(row, 'finalizedAt'),
        ]),
      );
      return;
    }
    case 'accounts-receivable': {
      const invoices = await fetchAllPages<Record<string, unknown>>('/fee-invoices', ctx);
      downloadCsv(
        'accounts-receivable.csv',
        ['Student', 'Fee type', 'Net amount', 'Paid', 'Remaining', 'Due date', 'Status'],
        invoices
          .filter((row) => Number(nested(row, 'remainingAmount') || 0) > 0)
          .map((row) => [
            nested(row, 'student.fullName'),
            nested(row, 'feeType.name'),
            nested(row, 'netAmount'),
            nested(row, 'paidAmount'),
            nested(row, 'remainingAmount'),
            nested(row, 'dueDate'),
            nested(row, 'status.label'),
          ]),
      );
      return;
    }
    case 'scholarship-discount': {
      const invoices = await fetchAllPages<Record<string, unknown>>('/fee-invoices', ctx);
      downloadCsv(
        'scholarship-discount.csv',
        ['Student', 'Fee type', 'Amount', 'Discount', 'Net amount', 'Period', 'Status'],
        invoices
          .filter((row) => Number(nested(row, 'discount') || 0) > 0)
          .map((row) => [
            nested(row, 'student.fullName'),
            nested(row, 'feeType.name'),
            nested(row, 'amount'),
            nested(row, 'discount'),
            nested(row, 'netAmount'),
            nested(row, 'billingPeriod'),
            nested(row, 'status.label'),
          ]),
      );
      return;
    }
    case 'audit': {
      const logs = await fetchAllPages<Record<string, unknown>>('/audit-logs', ctx);
      downloadCsv(
        'audit-compliance.csv',
        ['When', 'User', 'Action', 'Entity', 'Entity id'],
        logs.map((row) => [
          nested(row, 'createdAt'),
          nested(row, 'user.fullName'),
          nested(row, 'action'),
          nested(row, 'entityType'),
          nested(row, 'entityId'),
        ]),
      );
      return;
    }
    case 'leave': {
      const requests = await fetchAllPages<Record<string, unknown>>('/leave-requests', ctx);
      downloadCsv(
        'leave-management.csv',
        ['Kind', 'Student', 'Employee', 'From', 'To', 'Status', 'Reason'],
        requests.map((row) => [
          nested(row, 'kind'),
          nested(row, 'studentName'),
          nested(row, 'employeeName'),
          nested(row, 'fromDate'),
          nested(row, 'toDate'),
          nested(row, 'status'),
          nested(row, 'reason'),
        ]),
      );
      return;
    }
    case 'transport': {
      const assignments = await fetchAllPages<Record<string, unknown>>(
        '/transport/student-assignments',
        ctx,
      );
      downloadCsv(
        'transport.csv',
        ['Student', 'Phone', 'Route', 'Stop', 'Pickup', 'Dropoff'],
        assignments.map((row) => [
          nested(row, 'student.fullName'),
          nested(row, 'student.phone'),
          nested(row, 'route.name'),
          nested(row, 'stop.name'),
          nested(row, 'stop.pickupTime'),
          nested(row, 'stop.dropoffTime'),
        ]),
      );
      return;
    }
    case 'complaints': {
      const complaints = await fetchAllPages<Record<string, unknown>>(
        '/complaints',
        ctx,
      );
      downloadCsv(
        'complaint-resolution.csv',
        ['Subject', 'Type', 'Status', 'Priority', 'Requester', 'Created'],
        complaints.map((row) => [
          nested(row, 'subject'),
          nested(row, 'type'),
          nested(row, 'status'),
          nested(row, 'priority'),
          nested(row, 'requesterName'),
          nested(row, 'createdAt'),
        ]),
      );
      return;
    }
    case 'syllabus':
    case 'curriculum': {
      const units = await fetchAllPages<Record<string, unknown>>('/academic-ops/syllabus-units', ctx);
      downloadCsv(
        key === 'curriculum' ? 'curriculum-implementation.csv' : 'syllabus-coverage.csv',
        ['Unit', 'Subject', 'Batch', 'Planned', 'Completed', 'Coverage %', 'Status'],
        units.map((row) => [
          nested(row, 'title'),
          nested(row, 'subject.name'),
          nested(row, 'batch.name'),
          nested(row, 'plannedTopics'),
          nested(row, 'completedTopics'),
          nested(row, 'coveragePercent'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'lesson-plans': {
      const plans = await fetchAllPages<Record<string, unknown>>('/academic-ops/lesson-plans', ctx);
      downloadCsv(
        'lesson-plan-compliance.csv',
        ['Date', 'Title', 'Teacher', 'Subject', 'Batch', 'Status'],
        plans.map((row) => [
          nested(row, 'date'),
          nested(row, 'title'),
          nested(row, 'teacher.fullName'),
          nested(row, 'subject.name'),
          nested(row, 'batch.name'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'observation': {
      const rows = await fetchAllPages<Record<string, unknown>>('/academic-ops/observations', ctx);
      downloadCsv(
        'classroom-observation.csv',
        ['Date', 'Teacher', 'Observer', 'Score', 'Summary'],
        rows.map((row) => [
          nested(row, 'observedAt'),
          nested(row, 'teacher.fullName'),
          nested(row, 'observer.fullName'),
          nested(row, 'score'),
          nested(row, 'summary'),
        ]),
      );
      return;
    }
    case 'training': {
      const rows = await fetchAllPages<Record<string, unknown>>('/hr/trainings', ctx);
      downloadCsv(
        'teacher-training-pd.csv',
        ['Date', 'Staff', 'Title', 'Hours', 'Notes'],
        rows.map((row) => [
          nested(row, 'trainedAt'),
          nested(row, 'user.fullName'),
          nested(row, 'title'),
          nested(row, 'hours'),
          nested(row, 'notes'),
        ]),
      );
      return;
    }
    case 'cocurricular':
    case 'ptm': {
      const kind = key === 'ptm' ? 'ptm' : 'co_curricular';
      const rows = await fetchAllPages<Record<string, unknown>>('/academic-ops/events', ctx, { kind });
      downloadCsv(
        key === 'ptm' ? 'ptm.csv' : 'co-curricular.csv',
        ['Date', 'Title', 'Attendees', 'Notes'],
        rows.map((row) => [
          nested(row, 'eventDate'),
          nested(row, 'title'),
          nested(row, 'attendeeCount'),
          nested(row, 'notes'),
        ]),
      );
      return;
    }
    case 'discipline': {
      const rows = await fetchAllPages<Record<string, unknown>>('/academic-ops/discipline', ctx);
      downloadCsv(
        'discipline-behaviour.csv',
        ['Date', 'Student', 'Type', 'Action', 'Notes'],
        rows.map((row) => [
          nested(row, 'incidentDate'),
          nested(row, 'student.fullName'),
          nested(row, 'type'),
          nested(row, 'action'),
          nested(row, 'notes'),
        ]),
      );
      return;
    }
    case 'improvement':
    case 'challenges': {
      const kind = key === 'improvement' ? 'improvement_plan' : 'challenge';
      const rows = await fetchAllPages<Record<string, unknown>>('/academic-ops/actions', ctx, { kind });
      downloadCsv(
        key === 'improvement' ? 'academic-improvement-plan.csv' : 'academic-challenges.csv',
        ['Title', 'Status', 'Owner', 'Due', 'Notes'],
        rows.map((row) => [
          nested(row, 'title'),
          nested(row, 'status'),
          nested(row, 'owner.fullName'),
          nested(row, 'dueDate'),
          nested(row, 'notes'),
        ]),
      );
      return;
    }
    case 'petty-cash': {
      const rows = await fetchAllPages<Record<string, unknown>>('/finance-ops/petty-cash/vouchers', ctx);
      downloadCsv(
        'petty-cash.csv',
        ['Date', 'Fund', 'Payee', 'Amount', 'Description'],
        rows.map((row) => [
          nested(row, 'voucherDate'),
          nested(row, 'fund.name'),
          nested(row, 'payee'),
          nested(row, 'amount'),
          nested(row, 'description'),
        ]),
      );
      return;
    }
    case 'bank-rec': {
      const statements = await fetchAllPages<Record<string, unknown>>('/finance-ops/bank-statements', ctx);
      downloadCsv(
        'issued-cheque-record.csv',
        ['Month', 'Bank', 'Cheque book', 'Serial', 'Cheques', 'Total', 'Status'],
        statements.map((row) => [
          nested(row, 'monthLabel'),
          nested(row, 'bankName'),
          nested(row, 'chequeBookNo'),
          nested(row, 'serialRange'),
          nested(row, 'lineCount'),
          nested(row, 'total'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'accounts-payable':
    case 'maintenance':
    case 'utilities': {
      const extra =
        key === 'maintenance'
          ? { category: 'maintenance' }
          : undefined;
      const rows = await fetchAllPages<Record<string, unknown>>('/finance-ops/vendor-bills', ctx, extra);
      const utilityCategories = new Set(['electricity', 'gas', 'water', 'phone']);
      const filtered =
        key === 'utilities'
          ? rows.filter((row) => utilityCategories.has(String(row.category ?? '')))
          : rows;
      downloadCsv(
        key === 'maintenance'
          ? 'maintenance-repair-expense.csv'
          : key === 'utilities'
            ? 'utility-bills.csv'
            : 'accounts-payable.csv',
        ['Date', 'Vendor', 'Category', 'Amount', 'Paid', 'Remaining', 'Status'],
        filtered.map((row) => [
          nested(row, 'billDate'),
          nested(row, 'vendor.name'),
          nested(row, 'category'),
          nested(row, 'amount'),
          nested(row, 'paidAmount'),
          nested(row, 'remainingAmount'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'procurement': {
      const rows = await fetchAllPages<Record<string, unknown>>('/finance-ops/purchase-orders', ctx);
      downloadCsv(
        'procurement.csv',
        ['PO no', 'Date', 'Vendor', 'Total', 'Status'],
        rows.map((row) => [
          nested(row, 'poNo'),
          nested(row, 'orderDate'),
          nested(row, 'vendor.name'),
          nested(row, 'total'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'inventory': {
      const rows = await fetchAllPages<Record<string, unknown>>('/finance-ops/assets', ctx);
      const grouped = [...rows].sort((a, b) => {
        const scopeA = String(nested(a, 'scope') ?? 'school');
        const scopeB = String(nested(b, 'scope') ?? 'school');
        if (scopeA !== scopeB) return scopeA === 'school' ? -1 : 1;
        const classA = String(nested(a, 'batch.name') ?? '');
        const classB = String(nested(b, 'batch.name') ?? '');
        return classA.localeCompare(classB) || String(nested(a, 'name')).localeCompare(String(nested(b, 'name')));
      });
      downloadCsv(
        'inventory-fixed-assets.csv',
        ['Scope', 'Class', 'Name', 'Category', 'Quantity', 'Purchased', 'Cost', 'Status'],
        grouped.map((row) => [
          nested(row, 'scope') === 'class' ? 'Class-wise' : 'School-wise',
          nested(row, 'batch.name'),
          nested(row, 'name'),
          nested(row, 'category'),
          nested(row, 'quantity'),
          nested(row, 'purchaseDate'),
          nested(row, 'cost'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'cash-flow': {
      const branchId = requireBranch(ctx);
      const range = lastMonthRange();
      const data = await apiClient<{
        rows: Array<{ month: string; receipts: number; payments: number; net: number }>;
        totals: { receipts: number; payments: number; net: number };
      }>(
        withBranchScope('/finance-ops/reports/cash-flow', ctx.scope, {
          branchId,
          from: range.from,
          to: range.to,
        }),
        { token: ctx.token },
      );
      downloadCsv(
        'cash-flow.csv',
        ['Month', 'Receipts', 'Payments', 'Net'],
        [
          ...(data.rows ?? []).map((row) => [row.month, row.receipts, row.payments, row.net]),
          ['Total', data.totals.receipts, data.totals.payments, data.totals.net],
        ],
      );
      return;
    }
    case 'forecast': {
      const rows = await fetchAllPages<Record<string, unknown>>('/finance-ops/forecast-lines', ctx);
      downloadCsv(
        'financial-forecast.csv',
        ['Budget', 'Year', 'Month', 'Amount'],
        rows.map((row) => [
          nested(row, 'budget.name'),
          nested(row, 'budget.year'),
          nested(row, 'month'),
          nested(row, 'amount'),
        ]),
      );
      return;
    }
    case 'profitability': {
      const branchId = requireBranch(ctx);
      const range = lastMonthRange();
      const data = await apiClient<{
        branchName: string | null;
        income: number;
        expense: number;
        drawings: number;
        net: number;
      }>(
        withBranchScope('/finance-ops/reports/profitability', ctx.scope, {
          branchId,
          from: range.from,
          to: range.to,
        }),
        { token: ctx.token },
      );
      downloadCsv(
        'campus-profitability.csv',
        ['Campus', 'Income', 'Expense', 'Drawings', 'Profit'],
        [[data.branchName ?? branchId, data.income, data.expense, data.drawings ?? 0, data.net]],
      );
      return;
    }
    case 'risk': {
      const branchId = requireBranch(ctx);
      const data = await apiClient<{
        overdueReceivables: number;
        unpaidPayables: number;
        cashBalance: number;
        lastPayrollNet: number;
        cashToPayrollRatio: number | null;
        apAging: { current: number; days30: number; days60: number; days90: number };
        topVendorShare: { vendor: string; amount: number; share: number } | null;
      }>(withBranchScope('/finance-ops/reports/risk', ctx.scope, { branchId }), {
        token: ctx.token,
      });
      downloadCsv(
        'financial-risk.csv',
        ['Metric', 'Value'],
        [
          ['Overdue receivables', data.overdueReceivables],
          ['Unpaid payables', data.unpaidPayables],
          ['Cash balance', data.cashBalance],
          ['Last payroll net', data.lastPayrollNet],
          ['Cash to payroll ratio', data.cashToPayrollRatio ?? ''],
          ['AP current', data.apAging.current],
          ['AP 1-30 days', data.apAging.days30],
          ['AP 31-60 days', data.apAging.days60],
          ['AP 61+ days', data.apAging.days90],
          ['Top vendor', data.topVendorShare?.vendor ?? ''],
          ['Top vendor share %', data.topVendorShare?.share ?? ''],
        ],
      );
      return;
    }
    case 'recruitment': {
      const rows = await fetchAllPages<Record<string, unknown>>('/hr/applicants', ctx);
      downloadCsv(
        'staff-recruitment.csv',
        ['Applied', 'Name', 'Role', 'Stage', 'Hired user'],
        rows.map((row) => [
          nested(row, 'appliedAt'),
          nested(row, 'fullName'),
          nested(row, 'roleApplied'),
          nested(row, 'stage'),
          nested(row, 'hiredUser.fullName'),
        ]),
      );
      return;
    }
    case 'turnover': {
      const rows = await fetchAllPages<Record<string, unknown>>('/hr/contracts', ctx);
      downloadCsv(
        'staff-turnover.csv',
        ['Staff', 'Type', 'Start', 'End', 'Status'],
        rows.map((row) => [
          nested(row, 'user.fullName'),
          nested(row, 'employmentType'),
          nested(row, 'startDate'),
          nested(row, 'endDate'),
          nested(row, 'status'),
        ]),
      );
      return;
    }
    case 'infrastructure': {
      const rows = await fetchAllPages<Record<string, unknown>>('/campus-ops/work-orders', ctx);
      downloadCsv(
        'infrastructure-maintenance.csv',
        ['Reported', 'Location', 'Issue', 'Status', 'Cost'],
        rows.map((row) => [
          nested(row, 'reportedAt'),
          nested(row, 'location'),
          nested(row, 'issue'),
          nested(row, 'status'),
          nested(row, 'cost'),
        ]),
      );
      return;
    }
    case 'safety': {
      const rows = await fetchAllPages<Record<string, unknown>>('/campus-ops/safety', ctx);
      downloadCsv(
        'safety-security.csv',
        ['Date', 'Severity', 'Summary', 'Action'],
        rows.map((row) => [
          nested(row, 'incidentDate'),
          nested(row, 'severity'),
          nested(row, 'summary'),
          nested(row, 'action'),
        ]),
      );
      return;
    }
    case 'it-erp': {
      const branchId = requireBranch(ctx);
      const [status, outages] = await Promise.all([
        apiClient<{
          devices: Array<{
            name: string;
            location: string | null;
            isActive: boolean;
            lastSeenAt: string | null;
          }>;
          lastBiometricPunch: { punchedAt: string | null; device: string } | null;
        }>(withBranchScope('/campus-ops/it-status', ctx.scope, { branchId }), { token: ctx.token }),
        fetchAllPages<Record<string, unknown>>('/campus-ops/it-outages', ctx),
      ]);
      downloadCsv(
        'it-erp-status.csv',
        ['Section', 'Name', 'Detail'],
        [
          ...(status.devices ?? []).map((device) => [
            'Device',
            device.name,
            `${device.isActive ? 'active' : 'inactive'}${device.lastSeenAt ? `; last seen ${device.lastSeenAt}` : ''}`,
          ]),
          [
            'Last punch',
            status.lastBiometricPunch?.device ?? '',
            status.lastBiometricPunch?.punchedAt ?? 'none',
          ],
          ...outages.map((row) => ['Outage', nested(row, 'system'), nested(row, 'summary')]),
        ],
      );
      return;
    }
    case 'compliance': {
      const rows = await fetchAllPages<Record<string, unknown>>('/campus-ops/compliance', ctx);
      downloadCsv(
        'compliance-register.csv',
        ['Title', 'Category', 'Due', 'Status', 'Evidence'],
        rows.map((row) => [
          nested(row, 'title'),
          nested(row, 'category'),
          nested(row, 'dueDate'),
          nested(row, 'status'),
          nested(row, 'evidenceDocumentId'),
        ]),
      );
      return;
    }
    default:
      throw new Error('This report cannot be generated yet');
  }
}

export function generateCatalogReportErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Could not generate this report';
}
