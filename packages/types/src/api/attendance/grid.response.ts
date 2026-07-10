export interface AttendanceGridStatus {
  statusId: string;
  code: string;
  label: string;
}

export interface AttendanceGridRow {
  id: string;
  fullName: string;
  subtitle: string;
  gender: string | null;
  photographUrl: string | null;
  attendance: Record<string, AttendanceGridStatus | null>;
}

export interface AttendanceGridResponse {
  month: string;
  branchId: string;
  batchId: string | null;
  batchName: string | null;
  entityType: 'student' | 'teacher' | 'staff';
  total: number;
  dates: string[];
  rows: AttendanceGridRow[];
}
