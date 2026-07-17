export type AppRole = 'parent' | 'student';

export interface AuthUser {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthMeResponse {
  user: AuthUser;
}

export interface InstitutionSettings {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface PortalAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  other: number;
  presentRate: number;
}

export interface PortalAttendanceRecord {
  id: string;
  date: string;
  status?: { label: string; code?: string } | null;
  remarks?: string | null;
}

export interface PortalAttendanceResponse {
  summary: PortalAttendanceSummary;
  records: PaginatedResponse<PortalAttendanceRecord>;
}

export interface PortalFeeInvoice {
  id: string;
  feeType?: { name: string };
  netAmount: number;
  status?: { label: string; code?: string };
  paidAt?: string | null;
}

export interface PortalFeesResponse {
  outstanding: number;
  invoices: PaginatedResponse<PortalFeeInvoice>;
}

export interface PortalNoticeItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string | null;
}

export interface PortalTimetableSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectName: string | null;
  teacherName: string | null;
}

export interface PortalTimetableResponse {
  slots: PortalTimetableSlot[];
  todaySlots: PortalTimetableSlot[];
}

export interface PortalDocumentItem {
  id: string;
  title: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface LearningResourceItem {
  id: string;
  title: string;
  type: string;
  dueDate?: string | null;
  subjectName?: string | null;
  description?: string | null;
}

export interface PortalStudentInsightsResponse {
  student: { id: string; fullName: string; batch?: string; program?: string };
  overallPercentage: number | null;
  narrative: string;
  recommendations: Array<{ subject: string; tip: string }>;
  subjects: Array<{ subjectName: string; averagePercentage: number | null }>;
}

export interface LeaveRequestItem {
  id: string;
  studentId: string;
  studentName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface ParentChildData {
  student: { id: string; fullName: string };
  relationshipCode: string;
}

export interface ParentPortalData {
  parent: { id?: string; fullName: string; email?: string } | null;
  message?: string;
  children: ParentChildData[];
}

export interface StudentPortalData {
  student: {
    id: string;
    fullName: string;
    batch?: { name: string } | null;
    program?: { name: string } | null;
  } | null;
  message?: string;
}

export interface PortalStudentStatsResponse {
  attendanceRate: { value: number; changePercent: number | null };
  outstandingFees: { value: number; changePercent: number | null };
  averageGrade: { value: number; changePercent: number | null };
  upcomingClasses: { value: number; changePercent: number | null };
}

export interface PortalParentStatsResponse {
  childrenCount: { value: number; changePercent: number | null };
  aggregateAttendance: { value: number; changePercent: number | null };
  totalOutstanding: { value: number; changePercent: number | null };
  recentNotices: { value: number; changePercent: number | null };
}

export interface PortalProfileResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    gender: string | null;
    roles: string[];
  };
  student?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    batch?: { name: string } | null;
    program?: { name: string } | null;
  } | null;
  parent?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  children?: Array<{ id: string; fullName: string; relationshipCode: string }>;
}

export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
