export interface LibraryCategory {
  id: string;
  branchId: string;
  name: string;
  _count?: { books: number };
}

export interface LibraryCopy {
  id: string;
  bookId: string;
  copyCode: string;
  status: string;
}

export interface LibraryBook {
  id: string;
  branchId: string;
  categoryId: string | null;
  title: string;
  author: string;
  publisher: string | null;
  edition: string | null;
  isbn: string | null;
  accessionNo: string | null;
  category?: { id: string; name: string } | null;
  copies?: LibraryCopy[];
  _count?: { reservations: number };
}

export interface LibraryLoan {
  id: string;
  copyId: string;
  borrowerType: string;
  studentId: string | null;
  userId: string | null;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewedCount: number;
  branchId: string;
  copy?: {
    copyCode: string;
    book?: { id: string; title: string; author: string };
  };
  student?: { id: string; fullName: string } | null;
  user?: { id: string; fullName: string } | null;
  issuedBy?: { id: string; fullName: string } | null;
  fines?: LibraryFine[];
}

export interface LibraryReservation {
  id: string;
  bookId: string;
  borrowerType: string;
  studentId: string | null;
  userId: string | null;
  status: string;
  reservedAt: string;
  branchId: string;
  book?: {
    id: string;
    title: string;
    author: string;
    copies?: LibraryCopy[];
    _count?: { reservations: number };
  };
  student?: { id: string; fullName: string } | null;
  user?: { id: string; fullName: string } | null;
}

export interface LibraryFine {
  id: string;
  loanId: string;
  branchId: string;
  amount: string;
  status: string;
  reason: string | null;
  createdAt: string;
  loan?: LibraryLoan;
}

export interface LibraryStats {
  totalBooks: { count: number; trend?: number };
  totalCopies: { count: number; trend?: number };
  activeLoans: { count: number; trend?: number };
  overdueLoans: { count: number; trend?: number };
  activeReservations: { count: number; trend?: number };
  unpaidFines: { count: number; trend?: number };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function borrowerName(loan: Pick<LibraryLoan, 'student' | 'user'>): string {
  return loan.student?.fullName ?? loan.user?.fullName ?? '—';
}

export function statusBadgeCode(status: string): string {
  const normalized = status.toLowerCase();
  if (['available', 'paid', 'fulfilled'].includes(normalized)) return 'active';
  if (['lost', 'cancelled', 'waived'].includes(normalized)) return 'inactive';
  if (['issued', 'reserved', 'unpaid', 'active'].includes(normalized)) return 'pending';
  return normalized;
}

export function isOverdue(dueAt: string, returnedAt?: string | null): boolean {
  if (returnedAt) return false;
  return new Date(dueAt) < new Date();
}
