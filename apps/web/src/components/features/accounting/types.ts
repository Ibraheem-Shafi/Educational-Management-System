export interface AccountingAccount {
  id: string;
  branchId: string | null;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  memo: string | null;
  account?: { id: string; code: string; name: string; type: string };
}

export interface JournalVoucher {
  id: string;
  branchId: string;
  voucherType: string;
  voucherNo: string;
  voucherDate: string;
  narration: string | null;
  status: string;
  sourceType: string | null;
  sourceId: string | null;
  postedAt: string | null;
  lines: JournalLine[];
}

export interface BudgetLine {
  id: string;
  accountId: string;
  amount: number;
  account?: { id: string; code: string; name: string; type: string };
}

export interface Budget {
  id: string;
  branchId: string | null;
  year: number;
  name: string;
  lines: BudgetLine[];
}

export function formatMoney(value: number) {
  return value.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
