export interface AdmissionInquiry {
  id: string;
  branchId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  programInterest: string | null;
  status: string;
  notes: string | null;
  followUpAt: string | null;
  convertedStudentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Visitor {
  id: string;
  branchId: string;
  fullName: string;
  phone: string | null;
  purpose: string | null;
  hostName: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ComplaintRequest {
  id: string;
  branchId: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  requesterName: string | null;
  requesterPhone: string | null;
  assignedToId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ReceptionActivity {
  id: string;
  branchId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusBadgeCode(status: string): string {
  const normalized = status.toLowerCase();
  if (['enrolled', 'resolved', 'present'].includes(normalized)) return 'active';
  if (['lost', 'closed', 'cancelled'].includes(normalized)) return 'inactive';
  if (['new', 'open', 'pending', 'draft'].includes(normalized)) return 'pending';
  if (['contacted', 'interested', 'in_progress'].includes(normalized)) return 'draft';
  return normalized;
}
