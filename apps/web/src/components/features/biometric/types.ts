export interface BiometricDevice {
  id: string;
  branchId: string;
  name: string;
  vendor: string;
  deviceCode: string;
  location: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { externalIds: number; punchLogs: number };
}

export interface BiometricMapping {
  id: string;
  branchId: string;
  deviceId: string | null;
  externalPersonId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  updatedAt: string;
  device?: { id: string; name: string; deviceCode: string } | null;
  entity?: { id: string; fullName: string; phone?: string | null; email?: string } | null;
}

export interface BiometricPunchLog {
  id: string;
  deviceId: string;
  externalPersonId: string;
  punchedAt: string;
  payload: Record<string, unknown> | null;
  matched: boolean;
  attendanceRecordId: string | null;
  createdAt: string;
  device?: { id: string; name: string; deviceCode: string; branchId: string };
}

export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

export function statusBadgeCode(active: boolean): string {
  return active ? 'active' : 'inactive';
}

export function matchedBadgeCode(matched: boolean): string {
  return matched ? 'active' : 'inactive';
}
