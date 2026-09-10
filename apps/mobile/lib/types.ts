export type { AppRole } from './role';

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
  id?: string;
  dayOfWeek: number;
  dayName?: string;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectName: string | null;
  teacherName?: string | null;
  batchName?: string | null;
  batchId?: string;
  branchId?: string;
  subjectId?: string;
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
  student?: { fullName?: string } | null;
}

export interface LearningResourceItem {
  id: string;
  title: string;
  type: string;
  dueDate?: string | null;
  dueAt?: string | null;
  subjectName?: string | null;
  description?: string | null;
  body?: string | null;
  meetingUrl?: string | null;
  isPublished?: boolean;
  attachments?: Array<{ id: string; fileName: string }>;
  batch?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
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
  studentId?: string | null;
  studentName?: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string;
  attachmentFileName?: string | null;
}

export interface ParentChildData {
  student: { id: string; fullName: string };
  relationshipCode: string;
  attendance?: PortalAttendanceRecord[];
  fees?: { outstanding: number };
  assessments?: Array<{ percentage: number | null }>;
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

export interface Metric {
  value: number;
  changePercent: number | null;
}

export interface PortalStudentStatsResponse {
  attendanceRate: Metric;
  outstandingFees: Metric;
  averageGrade: Metric;
  upcomingClasses: Metric;
}

export interface PortalParentStatsResponse {
  childrenCount: Metric;
  aggregateAttendance: Metric;
  totalOutstanding: Metric;
  recentNotices: Metric;
}

export interface PortalAssessmentsResponse {
  averagePercentage: number | null;
  bySubject: Array<{ subjectName: string; averagePercentage: number | null }>;
  records: PaginatedResponse<{
    id: string;
    assessmentName?: string;
    subjectName?: string;
    percentage: number | null;
    grade?: string | null;
  }>;
}

export interface PortalCalendarEvent {
  date: string;
  title: string;
  type: string;
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

export interface TeacherHomeResponse {
  stats: {
    students: number;
    classes: number;
    todayAttendance: {
      present: number;
      absent: number;
      late: number;
      unmarked: number;
      total: number;
      rate: number;
    };
  };
  todaySlots: PortalTimetableSlot[];
  unmarkedBatches: Array<{
    id: string;
    name: string;
    branchId: string;
    marked: number;
    total: number;
  }>;
}

export interface TeacherBatch {
  id: string;
  name: string;
  branchId: string;
  programName: string | null;
  programId: string | null;
  studentCount: number;
}

export interface TeacherStudent {
  id: string;
  fullName: string;
  rollNumber: string | null;
  admissionNumber: string | null;
  batchId: string | null;
  branchId: string;
  batchName: string | null;
  programName: string | null;
}

export interface LookupStatus {
  id: string;
  code: string;
  label: string;
}

export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
